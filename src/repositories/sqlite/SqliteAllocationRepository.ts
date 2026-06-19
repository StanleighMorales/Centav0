import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { roundCentavos } from '../../utils/currency';
import { FIXED_USER_ID } from '../../constants/user';
import type { IAllocationRepository } from '../IAllocationRepository';
import type { Allocation, CreateAllocationInput, AllocationProgress } from '../../domain/types';

function rowToAllocation(row: any): Allocation {
  return {
    id: row.id, userId: row.userId,
    categoryId: row.categoryId ?? null, accountId: row.accountId ?? null,
    amount: row.amount, period: row.period, startDate: row.startDate,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}

function currentPeriodWindow(period: string): [string, string] {
  const now = new Date();
  if (period === 'Monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
  }
  // Weekly: Mon–Sun
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
}

export class SqliteAllocationRepository implements IAllocationRepository {
  async list(): Promise<Allocation[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM allocations WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAt ASC`,
      [FIXED_USER_ID],
    );
    return rows.map(rowToAllocation);
  }

  async getById(id: string): Promise<Allocation | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM allocations WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [id, FIXED_USER_ID],
    );
    return row ? rowToAllocation(row) : null;
  }

  async create(input: CreateAllocationInput): Promise<Allocation> {
    const db = await getDatabase();
    const id = newId();
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO allocations (id, userId, categoryId, accountId, amount, period, startDate, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
      [id, FIXED_USER_ID, input.categoryId ?? null, input.accountId ?? null, roundCentavos(input.amount), input.period, input.startDate, now, now],
    );
    const created = await this.getById(id);
    if (!created) throw new Error('Allocation creation failed silently');
    return created;
  }

  async update(id: string, input: Partial<CreateAllocationInput>): Promise<Allocation> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Allocation ${id} not found`);
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE allocations SET amount = ?, period = ?, startDate = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [roundCentavos(input.amount ?? existing.amount), input.period ?? existing.period, input.startDate ?? existing.startDate, now, id, FIXED_USER_ID],
    );
    const updated = await this.getById(id);
    if (!updated) throw new Error('Allocation vanished after update');
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE allocations SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [now, now, id, FIXED_USER_ID],
    );
  }

  async getProgress(id: string): Promise<AllocationProgress> {
    const allocation = await this.getById(id);
    if (!allocation) throw new Error(`Allocation ${id} not found`);
    const [from, to] = currentPeriodWindow(allocation.period);
    const db = await getDatabase();
    let spent = 0;
    if (allocation.categoryId) {
      const row = await db.getFirstAsync<any>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
         WHERE userId = ? AND categoryId = ? AND type = 'Expense' AND date >= ? AND date <= ? AND deletedAt IS NULL`,
        [FIXED_USER_ID, allocation.categoryId, from, to],
      );
      spent = row?.total ?? 0;
    } else if (allocation.accountId) {
      const row = await db.getFirstAsync<any>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
         WHERE userId = ? AND accountId = ? AND type = 'Expense' AND date >= ? AND date <= ? AND deletedAt IS NULL`,
        [FIXED_USER_ID, allocation.accountId, from, to],
      );
      spent = row?.total ?? 0;
    }
    const remaining = Math.max(0, allocation.amount - spent);
    const percent = allocation.amount > 0 ? Math.min(100, (spent / allocation.amount) * 100) : 0;
    return { allocated: allocation.amount, spent, remaining, percent };
  }
}
