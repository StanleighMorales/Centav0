import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { roundCentavos } from '../../utils/currency';
import { FIXED_USER_ID } from '../../constants/user';
import type { RecurringTransaction, CreateRecurringTransactionInput, UpdateRecurringTransactionInput } from '../../domain/types';

function rowToRecurring(row: any): RecurringTransaction {
  return {
    id: row.id, userId: row.userId,
    amount: row.amount, type: row.type,
    categoryId: row.categoryId ?? null, accountId: row.accountId, note: row.note ?? null,
    frequency: row.frequency,
    dayOfMonth: row.dayOfMonth ?? null,
    semiMonthDays: row.semiMonthDays ? JSON.parse(row.semiMonthDays) : null,
    dayOfWeek: row.dayOfWeek ?? null,
    startDate: row.startDate, endDate: row.endDate ?? null,
    lastMaterializedDate: row.lastMaterializedDate ?? null,
    createdAt: row.createdAt, updatedAt: row.updatedAt, deletedAt: row.deletedAt ?? null,
    isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}

export class SqliteRecurringTransactionRepository {
  async list(): Promise<RecurringTransaction[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM recurring_transactions WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAt ASC`,
      [FIXED_USER_ID],
    );
    return rows.map(rowToRecurring);
  }

  async getById(id: string): Promise<RecurringTransaction | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM recurring_transactions WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [id, FIXED_USER_ID],
    );
    return row ? rowToRecurring(row) : null;
  }

  async create(input: CreateRecurringTransactionInput): Promise<RecurringTransaction> {
    const db = await getDatabase();
    const id = newId();
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO recurring_transactions
        (id, userId, amount, type, categoryId, accountId, note, frequency, dayOfMonth, semiMonthDays, dayOfWeek, startDate, endDate, lastMaterializedDate, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, 1, NULL)`,
      [
        id, FIXED_USER_ID, roundCentavos(input.amount), input.type,
        input.categoryId ?? null, input.accountId, input.note ?? null,
        input.frequency, input.dayOfMonth ?? null,
        input.semiMonthDays ? JSON.stringify(input.semiMonthDays) : null,
        input.dayOfWeek ?? null, input.startDate, input.endDate ?? null,
        now, now,
      ],
    );
    const created = await this.getById(id);
    if (!created) throw new Error('Recurring transaction creation failed silently');
    return created;
  }

  async update(id: string, input: UpdateRecurringTransactionInput): Promise<RecurringTransaction> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Recurring transaction ${id} not found`);
    const db = await getDatabase();
    const now = nowIso();
    const merged = { ...existing, ...input };
    await db.runAsync(
      `UPDATE recurring_transactions SET
        amount = ?, type = ?, categoryId = ?, accountId = ?, note = ?,
        frequency = ?, dayOfMonth = ?, semiMonthDays = ?, dayOfWeek = ?,
        startDate = ?, endDate = ?, updatedAt = ?, isDirty = 1
       WHERE id = ? AND userId = ?`,
      [
        roundCentavos(merged.amount), merged.type, merged.categoryId ?? null, merged.accountId, merged.note ?? null,
        merged.frequency, merged.dayOfMonth ?? null,
        merged.semiMonthDays ? JSON.stringify(merged.semiMonthDays) : null,
        merged.dayOfWeek ?? null, merged.startDate, merged.endDate ?? null,
        now, id, FIXED_USER_ID,
      ],
    );
    const updated = await this.getById(id);
    if (!updated) throw new Error('Recurring transaction vanished after update');
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE recurring_transactions SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [now, now, id, FIXED_USER_ID],
    );
  }

  async markMaterialized(id: string, lastMaterializedDate: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE recurring_transactions SET lastMaterializedDate = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [lastMaterializedDate, id, FIXED_USER_ID],
    );
  }
}
