import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { roundCentavos } from '../../utils/currency';
import { FIXED_USER_ID } from '../../constants/user';
import type { IDebtRepository } from '../IDebtRepository';
import type { Debt, CreateDebtInput, UpdateDebtInput, DebtStatus } from '../../domain/types';

function rowToDebt(row: any): Debt {
  return {
    id: row.id, userId: row.userId, creditor: row.creditor,
    originalAmount: row.originalAmount, outstandingBalance: row.outstandingBalance,
    dueDate: row.dueDate ?? null, status: row.status,
    interestRate: row.interestRate ?? null, note: row.note ?? null,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}

function computeStatus(outstandingBalance: number, dueDate: string | null): DebtStatus {
  if (outstandingBalance <= 0) return 'Paid';
  if (dueDate && dueDate < nowIso().slice(0, 10)) return 'Overdue';
  return 'Open';
}

export class SqliteDebtRepository implements IDebtRepository {
  async list(): Promise<Debt[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM debts WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAt DESC`,
      [FIXED_USER_ID],
    );
    return rows.map(rowToDebt);
  }

  async getById(id: string): Promise<Debt | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM debts WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [id, FIXED_USER_ID],
    );
    return row ? rowToDebt(row) : null;
  }

  async create(input: CreateDebtInput): Promise<Debt> {
    const db = await getDatabase();
    const id = newId();
    const now = nowIso();
    const amount = roundCentavos(input.originalAmount);
    const dueDate = input.dueDate ?? null;
    const status = computeStatus(amount, dueDate);
    await db.runAsync(
      `INSERT INTO debts (id, userId, creditor, originalAmount, outstandingBalance, dueDate, status, interestRate, note, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
      [id, FIXED_USER_ID, input.creditor, amount, amount, dueDate, status, input.interestRate ?? null, input.note ?? null, now, now],
    );
    const created = await this.getById(id);
    if (!created) throw new Error('Debt creation failed silently');
    return created;
  }

  async update(id: string, input: UpdateDebtInput): Promise<Debt> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Debt ${id} not found`);
    const db = await getDatabase();
    const now = nowIso();
    const dueDate = 'dueDate' in input ? (input.dueDate ?? null) : existing.dueDate;
    const status = computeStatus(existing.outstandingBalance, dueDate);
    await db.runAsync(
      `UPDATE debts SET creditor = ?, dueDate = ?, status = ?, interestRate = ?, note = ?, updatedAt = ?, isDirty = 1
       WHERE id = ? AND userId = ?`,
      [
        input.creditor ?? existing.creditor, dueDate, status,
        'interestRate' in input ? (input.interestRate ?? null) : existing.interestRate,
        'note' in input ? (input.note ?? null) : existing.note,
        now, id, FIXED_USER_ID,
      ],
    );
    const updated = await this.getById(id);
    if (!updated) throw new Error('Debt vanished after update');
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE debts SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [now, now, id, FIXED_USER_ID],
    );
  }
}
