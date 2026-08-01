import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { roundCentavos } from '../../utils/currency';
import { FIXED_USER_ID } from '../../constants/user';
import { syncLinkedCreditDebt } from './creditSync';
import type { ILendingRepository } from '../ILendingRepository';
import type { Lending, CreateLendingInput, UpdateLendingInput } from '../../domain/types';

function rowToLending(row: any): Lending {
  return {
    id: row.id, userId: row.userId, personId: row.personId,
    amount: row.amount, outstandingBalance: row.outstandingBalance,
    accountId: row.accountId, date: row.date, note: row.note ?? null,
    status: row.status,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}

export class SqliteLendingRepository implements ILendingRepository {
  async list(): Promise<Lending[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM lendings WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAt DESC`,
      [FIXED_USER_ID],
    );
    return rows.map(rowToLending);
  }

  async getById(id: string): Promise<Lending | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM lendings WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [id, FIXED_USER_ID],
    );
    return row ? rowToLending(row) : null;
  }

  async create(input: CreateLendingInput): Promise<Lending> {
    const db = await getDatabase();
    const id = newId();
    const now = nowIso();
    const amount = roundCentavos(input.amount);
    const account = await db.getFirstAsync<any>(
      `SELECT currentBalance FROM accounts WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [input.accountId, FIXED_USER_ID],
    );
    if (!account) throw new Error(`Account ${input.accountId} not found`);
    if (amount > roundCentavos(account.currentBalance)) {
      throw new Error('Lending amount is more than this account has');
    }
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO lendings (id, userId, personId, amount, outstandingBalance, accountId, date, note, status, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, NULL, 1, NULL)`,
        [id, FIXED_USER_ID, input.personId, amount, amount, input.accountId, input.date, input.note ?? null, now, now],
      );
      await db.runAsync(
        `UPDATE accounts SET currentBalance = currentBalance - ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [amount, now, input.accountId, FIXED_USER_ID],
      );
      await syncLinkedCreditDebt(db, input.accountId);
    });
    const created = await this.getById(id);
    if (!created) throw new Error('Lending creation failed silently');
    return created;
  }

  async update(id: string, input: UpdateLendingInput): Promise<Lending> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Lending ${id} not found`);
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE lendings SET note = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      ['note' in input ? (input.note ?? null) : existing.note, now, id, FIXED_USER_ID],
    );
    const updated = await this.getById(id);
    if (!updated) throw new Error('Lending vanished after update');
    return updated;
  }

  async markPaid(id: string): Promise<Lending> {
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE lendings SET outstandingBalance = 0, status = 'Paid', updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [now, id, FIXED_USER_ID],
    );
    const updated = await this.getById(id);
    if (!updated) throw new Error('Lending vanished after markPaid');
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const lending = await this.getById(id);
    if (!lending) return;
    const db = await getDatabase();
    const now = nowIso();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE lendings SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [now, now, id, FIXED_USER_ID],
      );
      // Reverse the original debit — give the money back to the source account.
      await db.runAsync(
        `UPDATE accounts SET currentBalance = currentBalance + ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [lending.amount, now, lending.accountId, FIXED_USER_ID],
      );
      await syncLinkedCreditDebt(db, lending.accountId);
    });
  }
}
