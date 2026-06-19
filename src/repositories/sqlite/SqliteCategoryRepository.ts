import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { FIXED_USER_ID } from '../../constants/user';
import type { ICategoryRepository } from '../ICategoryRepository';
import type { Category, CategoryType, CreateCategoryInput, UpdateCategoryInput } from '../../domain/types';

function rowToCategory(row: any): Category {
  return {
    id: row.id, userId: row.userId, name: row.name, type: row.type,
    icon: row.icon ?? null, color: row.color ?? null,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null, isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}

export class SqliteCategoryRepository implements ICategoryRepository {
  async list(type?: CategoryType): Promise<Category[]> {
    const db = await getDatabase();
    if (type) {
      const rows = await db.getAllAsync<any>(
        `SELECT * FROM categories WHERE userId = ? AND type = ? AND deletedAt IS NULL ORDER BY name ASC`,
        [FIXED_USER_ID, type],
      );
      return rows.map(rowToCategory);
    }
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM categories WHERE userId = ? AND deletedAt IS NULL ORDER BY type ASC, name ASC`,
      [FIXED_USER_ID],
    );
    return rows.map(rowToCategory);
  }

  async getById(id: string): Promise<Category | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM categories WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [id, FIXED_USER_ID],
    );
    return row ? rowToCategory(row) : null;
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const db = await getDatabase();
    const id = newId();
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO categories (id, userId, name, type, icon, color, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
      [id, FIXED_USER_ID, input.name, input.type, input.icon ?? null, input.color ?? null, now, now],
    );
    const created = await this.getById(id);
    if (!created) throw new Error('Category creation failed silently');
    return created;
  }

  async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Category ${id} not found`);
    const db = await getDatabase();
    const updatedAt = nowIso();
    await db.runAsync(
      `UPDATE categories SET name = ?, icon = ?, color = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [input.name ?? existing.name, input.icon ?? existing.icon, input.color ?? existing.color, updatedAt, id, FIXED_USER_ID],
    );
    const updated = await this.getById(id);
    if (!updated) throw new Error('Category vanished after update');
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE categories SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [now, now, id, FIXED_USER_ID],
    );
  }
}
