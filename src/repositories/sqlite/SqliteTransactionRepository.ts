import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { roundCentavos } from '../../utils/currency';
import { FIXED_USER_ID } from '../../constants/user';
import type { ITransactionRepository } from '../ITransactionRepository';
import type { Transaction, CreateTransactionInput, UpdateTransactionInput, TransactionFilter, CreateTransferInput } from '../../domain/types';

function rowToTransaction(row: any): Transaction {
  return {
    id: row.id, userId: row.userId, date: row.date,
    amount: row.amount, type: row.type,
    categoryId: row.categoryId ?? null,
    accountId: row.accountId,
    toAccountId: row.toAccountId ?? null,
    note: row.note ?? null,
    receiptUri: row.receiptUri ?? null,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}

// Income adds to balance, Expense subtracts. Transfer legs are applied
// explicitly by createTransfer/update/softDelete — delta() is not used for them.
function delta(type: string, amount: number): number {
  return type === 'Income' ? amount : -amount;
}

export class SqliteTransactionRepository implements ITransactionRepository {
  async list(filter?: TransactionFilter): Promise<Transaction[]> {
    const db = await getDatabase();
    const conditions = ['userId = ?', 'deletedAt IS NULL'];
    const params: any[] = [FIXED_USER_ID];
    if (filter?.from)       { conditions.push('date >= ?');       params.push(filter.from); }
    if (filter?.to)         { conditions.push('date <= ?');       params.push(filter.to); }
    if (filter?.type)       { conditions.push('type = ?');        params.push(filter.type); }
    if (filter?.categoryId) { conditions.push('categoryId = ?'); params.push(filter.categoryId); }
    if (filter?.accountId)  { conditions.push('accountId = ?');  params.push(filter.accountId); }
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM transactions WHERE ${conditions.join(' AND ')} ORDER BY date DESC, createdAt DESC`,
      params,
    );
    return rows.map(rowToTransaction);
  }

  async getById(id: string): Promise<Transaction | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM transactions WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [id, FIXED_USER_ID],
    );
    return row ? rowToTransaction(row) : null;
  }

  async create(input: CreateTransactionInput): Promise<Transaction> {
    const db = await getDatabase();
    const id = newId();
    const now = nowIso();
    const amount = roundCentavos(input.amount);
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO transactions (id, userId, date, amount, type, categoryId, accountId, toAccountId, note, receiptUri, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL, 1, NULL)`,
        [id, FIXED_USER_ID, input.date, amount, input.type, input.categoryId ?? null, input.accountId, input.note ?? null, input.receiptUri ?? null, now, now],
      );
      await db.runAsync(
        `UPDATE accounts SET currentBalance = currentBalance + ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [delta(input.type, amount), now, input.accountId, FIXED_USER_ID],
      );
    });
    const created = await this.getById(id);
    if (!created) throw new Error('Transaction creation failed silently');
    return created;
  }

  async createTransfer(input: CreateTransferInput): Promise<Transaction> {
    if (input.accountId === input.toAccountId) {
      throw new Error('Source and destination accounts must be different');
    }
    const db = await getDatabase();
    const id = newId();
    const now = nowIso();
    const amount = roundCentavos(input.amount);
    const source = await db.getFirstAsync<any>(
      `SELECT currentBalance, allowsOverdraft FROM accounts WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [input.accountId, FIXED_USER_ID],
    );
    if (!source) throw new Error(`Account ${input.accountId} not found`);
    const dest = await db.getFirstAsync<any>(
      `SELECT id FROM accounts WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [input.toAccountId, FIXED_USER_ID],
    );
    if (!dest) throw new Error(`Account ${input.toAccountId} not found`);
    // Overdraft-capable sources may go negative (spending credit); other
    // account types cannot be overdrawn by a transfer, same rule as debt payments.
    if (!source.allowsOverdraft && amount > roundCentavos(source.currentBalance)) {
      throw new Error('Transfer exceeds source account balance');
    }
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO transactions (id, userId, date, amount, type, categoryId, accountId, toAccountId, note, receiptUri, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
         VALUES (?, ?, ?, ?, 'Transfer', NULL, ?, ?, ?, NULL, ?, ?, NULL, 1, NULL)`,
        [id, FIXED_USER_ID, input.date, amount, input.accountId, input.toAccountId, input.note ?? null, now, now],
      );
      await db.runAsync(
        `UPDATE accounts SET currentBalance = currentBalance - ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [amount, now, input.accountId, FIXED_USER_ID],
      );
      await db.runAsync(
        `UPDATE accounts SET currentBalance = currentBalance + ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [amount, now, input.toAccountId, FIXED_USER_ID],
      );
    });
    const created = await this.getById(id);
    if (!created) throw new Error('Transfer creation failed silently');
    return created;
  }

  async update(id: string, input: UpdateTransactionInput): Promise<Transaction> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Transaction ${id} not found`);
    if (existing.type === 'Transfer' || input.type === 'Transfer') {
      throw new Error('Transfers cannot be edited — delete and recreate instead');
    }
    const db = await getDatabase();
    const now = nowIso();
    const newAmount = roundCentavos(input.amount ?? existing.amount);
    const newType = input.type ?? existing.type;
    const newAccountId = input.accountId ?? existing.accountId;
    await db.withTransactionAsync(async () => {
      // Reverse old effect on old account
      await db.runAsync(
        `UPDATE accounts SET currentBalance = currentBalance + ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [-delta(existing.type, existing.amount), now, existing.accountId, FIXED_USER_ID],
      );
      // Apply new effect on (possibly new) account
      await db.runAsync(
        `UPDATE accounts SET currentBalance = currentBalance + ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [delta(newType, newAmount), now, newAccountId, FIXED_USER_ID],
      );
      await db.runAsync(
        `UPDATE transactions SET date = ?, amount = ?, type = ?, categoryId = ?, accountId = ?, note = ?, receiptUri = ?, updatedAt = ?, isDirty = 1
         WHERE id = ? AND userId = ?`,
        [
          input.date ?? existing.date, newAmount, newType,
          input.categoryId ?? existing.categoryId, newAccountId,
          'note' in input ? (input.note ?? null) : existing.note,
          'receiptUri' in input ? (input.receiptUri ?? null) : existing.receiptUri,
          now, id, FIXED_USER_ID,
        ],
      );
    });
    const updated = await this.getById(id);
    if (!updated) throw new Error('Transaction vanished after update');
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) return;
    const db = await getDatabase();
    const now = nowIso();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE transactions SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [now, now, id, FIXED_USER_ID],
      );
      if (existing.type === 'Transfer' && existing.toAccountId) {
        // Reverse both legs: give back to source, take back from destination.
        await db.runAsync(
          `UPDATE accounts SET currentBalance = currentBalance + ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
          [existing.amount, now, existing.accountId, FIXED_USER_ID],
        );
        await db.runAsync(
          `UPDATE accounts SET currentBalance = currentBalance - ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
          [existing.amount, now, existing.toAccountId, FIXED_USER_ID],
        );
      } else {
        await db.runAsync(
          `UPDATE accounts SET currentBalance = currentBalance + ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
          [-delta(existing.type, existing.amount), now, existing.accountId, FIXED_USER_ID],
        );
      }
    });
  }
}
