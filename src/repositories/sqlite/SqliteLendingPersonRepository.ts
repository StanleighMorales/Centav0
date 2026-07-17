import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { FIXED_USER_ID } from '../../constants/user';
import type { ILendingPersonRepository } from '../ILendingPersonRepository';
import type { LendingPerson, CreateLendingPersonInput, UpdateLendingPersonInput } from '../../domain/types';

function rowToPerson(row: any): LendingPerson {
  return {
    id: row.id, userId: row.userId, name: row.name,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}

export class SqliteLendingPersonRepository implements ILendingPersonRepository {
  async list(): Promise<LendingPerson[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM lending_people WHERE userId = ? AND deletedAt IS NULL ORDER BY name ASC`,
      [FIXED_USER_ID],
    );
    return rows.map(rowToPerson);
  }

  async getById(id: string): Promise<LendingPerson | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM lending_people WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [id, FIXED_USER_ID],
    );
    return row ? rowToPerson(row) : null;
  }

  async create(input: CreateLendingPersonInput): Promise<LendingPerson> {
    const db = await getDatabase();
    const id = newId();
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO lending_people (id, userId, name, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
       VALUES (?, ?, ?, ?, ?, NULL, 1, NULL)`,
      [id, FIXED_USER_ID, input.name, now, now],
    );
    const created = await this.getById(id);
    if (!created) throw new Error('LendingPerson creation failed silently');
    return created;
  }

  async update(id: string, input: UpdateLendingPersonInput): Promise<LendingPerson> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`LendingPerson ${id} not found`);
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE lending_people SET name = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [input.name ?? existing.name, now, id, FIXED_USER_ID],
    );
    const updated = await this.getById(id);
    if (!updated) throw new Error('LendingPerson vanished after update');
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE lending_people SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [now, now, id, FIXED_USER_ID],
    );
  }
}
