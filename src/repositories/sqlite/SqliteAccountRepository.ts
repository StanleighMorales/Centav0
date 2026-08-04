import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso, nextDueDateIso } from '../../utils/date';
import { roundCentavos } from '../../utils/currency';
import { FIXED_USER_ID } from '../../constants/user';
import type { IAccountRepository } from '../IAccountRepository';
import type { Account, CreateAccountInput, UpdateAccountInput } from '../../domain/types';

function rowToAccount(row: any): Account {
  return {
    id: row.id, userId: row.userId, name: row.name,
    accountTypeId: row.accountTypeId, allowsOverdraft: row.allowsOverdraft === 1,
    typeName: row.typeName,
    initialBalance: row.initialBalance, currentBalance: row.currentBalance,
    billDay: row.billDay ?? null, dueDay: row.dueDay ?? null,
    creditLimit: row.creditLimit ?? null,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null, isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}

const SELECT_ACCOUNT = `
  SELECT a.*, t.name AS typeName
  FROM accounts a
  JOIN account_types t ON t.id = a.accountTypeId
`;

export class SqliteAccountRepository implements IAccountRepository {
  async list(): Promise<Account[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `${SELECT_ACCOUNT} WHERE a.userId = ? AND a.deletedAt IS NULL ORDER BY a.createdAt ASC`,
      [FIXED_USER_ID],
    );
    return rows.map(rowToAccount);
  }

  async listDeleted(): Promise<Account[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `${SELECT_ACCOUNT} WHERE a.userId = ? AND a.deletedAt IS NOT NULL ORDER BY a.deletedAt DESC`,
      [FIXED_USER_ID],
    );
    return rows.map(rowToAccount);
  }

  async getById(id: string): Promise<Account | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `${SELECT_ACCOUNT} WHERE a.id = ? AND a.userId = ? AND a.deletedAt IS NULL`,
      [id, FIXED_USER_ID],
    );
    return row ? rowToAccount(row) : null;
  }

  async create(input: CreateAccountInput): Promise<Account> {
    const db = await getDatabase();
    const id = newId();
    const now = nowIso();
    const accountType = await db.getFirstAsync<any>(
      `SELECT allowsOverdraft FROM account_types WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [input.accountTypeId, FIXED_USER_ID],
    );
    if (!accountType) throw new Error(`Account type ${input.accountTypeId} not found`);
    // Credit accounts start full at their max balance (available credit),
    // not at the form's balance input — spending draws it down from there.
    const initial = accountType.allowsOverdraft
      ? roundCentavos(input.creditLimit ?? 0)
      : roundCentavos(input.initialBalance);
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO accounts (id, userId, name, accountTypeId, allowsOverdraft, initialBalance, currentBalance, billDay, dueDay, creditLimit, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
        [
          id, FIXED_USER_ID, input.name, input.accountTypeId, accountType.allowsOverdraft,
          initial, initial, input.billDay ?? null, input.dueDay ?? null, input.creditLimit ?? null, now, now,
        ],
      );
      if (accountType.allowsOverdraft) {
        const dueDate = input.dueDay != null ? nextDueDateIso(input.dueDay) : null;
        await db.runAsync(
          `INSERT INTO debts (id, userId, creditor, originalAmount, outstandingBalance, dueDate, status, debtType, disbursementAccountId, linkedAccountId, interestRate, note, isInstallment, monthlyPayment, installmentFee, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
           VALUES (?, ?, ?, 0, 0, ?, 'Open', 'Credit', NULL, ?, NULL, NULL, 0, NULL, NULL, ?, ?, NULL, 1, NULL)`,
          [newId(), FIXED_USER_ID, input.name, dueDate, id, now, now],
        );
      }
    });
    const created = await this.getById(id);
    if (!created) throw new Error('Account creation failed silently');
    return created;
  }

  async update(id: string, input: UpdateAccountInput): Promise<Account> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Account ${id} not found`);
    const db = await getDatabase();
    const updatedAt = nowIso();
    let allowsOverdraft = existing.allowsOverdraft;
    if (input.accountTypeId && input.accountTypeId !== existing.accountTypeId) {
      const accountType = await db.getFirstAsync<any>(
        `SELECT allowsOverdraft FROM account_types WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
        [input.accountTypeId, FIXED_USER_ID],
      );
      if (!accountType) throw new Error(`Account type ${input.accountTypeId} not found`);
      allowsOverdraft = accountType.allowsOverdraft === 1;
    }
    await db.runAsync(
      `UPDATE accounts SET name = ?, accountTypeId = ?, allowsOverdraft = ?, billDay = ?, dueDay = ?, creditLimit = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [
        input.name ?? existing.name, input.accountTypeId ?? existing.accountTypeId, allowsOverdraft ? 1 : 0,
        'billDay' in input ? (input.billDay ?? null) : existing.billDay,
        'dueDay' in input ? (input.dueDay ?? null) : existing.dueDay,
        'creditLimit' in input ? (input.creditLimit ?? null) : existing.creditLimit,
        updatedAt, id, FIXED_USER_ID,
      ],
    );
    const updated = await this.getById(id);
    if (!updated) throw new Error('Account vanished after update');
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const db = await getDatabase();
    const now = nowIso();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE accounts SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [now, now, id, FIXED_USER_ID],
      );
      // Cascade: a Credit Card account's linked debt has no life outside the account.
      await db.runAsync(
        `UPDATE debts SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE linkedAccountId = ? AND userId = ?`,
        [now, now, id, FIXED_USER_ID],
      );
    });
  }

  async getBalance(id: string): Promise<number> {
    const account = await this.getById(id);
    if (!account) throw new Error(`Account ${id} not found`);
    return account.currentBalance;
  }
}
