import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { FIXED_USER_ID } from '../../constants/user';
import type { IAccountTypeRepository } from '../IAccountTypeRepository';
import type { AccountType, CreateAccountTypeInput, UpdateAccountTypeInput } from '../../domain/types';

function rowToAccountType(row: any): AccountType {
  return {
    id: row.id, userId: row.userId, name: row.name,
    allowsOverdraft: row.allowsOverdraft === 1,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null, isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}

export class SqliteAccountTypeRepository implements IAccountTypeRepository {
  async list(): Promise<AccountType[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM account_types WHERE userId = ? AND deletedAt IS NULL ORDER BY name ASC`,
      [FIXED_USER_ID],
    );
    return rows.map(rowToAccountType);
  }

  async getById(id: string): Promise<AccountType | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM account_types WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [id, FIXED_USER_ID],
    );
    return row ? rowToAccountType(row) : null;
  }

  async create(input: CreateAccountTypeInput): Promise<AccountType> {
    const db = await getDatabase();
    const id = newId();
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO account_types (id, userId, name, allowsOverdraft, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
      [id, FIXED_USER_ID, input.name, input.allowsOverdraft ? 1 : 0, now, now],
    );
    const created = await this.getById(id);
    if (!created) throw new Error('AccountType creation failed silently');
    return created;
  }

  async update(id: string, input: UpdateAccountTypeInput): Promise<AccountType> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`AccountType ${id} not found`);
    const db = await getDatabase();
    const updatedAt = nowIso();
    await db.runAsync(
      `UPDATE account_types SET name = ?, allowsOverdraft = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [
        input.name ?? existing.name,
        ('allowsOverdraft' in input ? !!input.allowsOverdraft : existing.allowsOverdraft) ? 1 : 0,
        updatedAt, id, FIXED_USER_ID,
      ],
    );
    const updated = await this.getById(id);
    if (!updated) throw new Error('AccountType vanished after update');
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE account_types SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [now, now, id, FIXED_USER_ID],
    );
  }
}
