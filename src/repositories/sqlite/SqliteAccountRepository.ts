import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { roundCentavos } from '../../utils/currency';
import { FIXED_USER_ID } from '../../constants/user';
import type { IAccountRepository } from '../IAccountRepository';
import type { Account, CreateAccountInput, UpdateAccountInput } from '../../domain/types';

function rowToAccount(row: any): Account {
  return {
    id: row.id, userId: row.userId, name: row.name, type: row.type,
    initialBalance: row.initialBalance, currentBalance: row.currentBalance,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null, isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}

export class SqliteAccountRepository implements IAccountRepository {
  async list(): Promise<Account[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM accounts WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAt ASC`,
      [FIXED_USER_ID],
    );
    return rows.map(rowToAccount);
  }

  async getById(id: string): Promise<Account | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM accounts WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [id, FIXED_USER_ID],
    );
    return row ? rowToAccount(row) : null;
  }

  async create(input: CreateAccountInput): Promise<Account> {
    const db = await getDatabase();
    const id = newId();
    const now = nowIso();
    const initial = roundCentavos(input.initialBalance);
    await db.runAsync(
      `INSERT INTO accounts (id, userId, name, type, initialBalance, currentBalance, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
      [id, FIXED_USER_ID, input.name, input.type, initial, initial, now, now],
    );
    const created = await this.getById(id);
    if (!created) throw new Error('Account creation failed silently');
    return created;
  }

  async update(id: string, input: UpdateAccountInput): Promise<Account> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Account ${id} not found`);
    const db = await getDatabase();
    const updatedAt = nowIso();
    await db.runAsync(
      `UPDATE accounts SET name = ?, type = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [input.name ?? existing.name, input.type ?? existing.type, updatedAt, id, FIXED_USER_ID],
    );
    const updated = await this.getById(id);
    if (!updated) throw new Error('Account vanished after update');
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE accounts SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [now, now, id, FIXED_USER_ID],
    );
  }

  async getBalance(id: string): Promise<number> {
    const account = await this.getById(id);
    if (!account) throw new Error(`Account ${id} not found`);
    return account.currentBalance;
  }
}
