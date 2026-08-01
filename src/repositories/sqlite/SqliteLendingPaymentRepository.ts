import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { roundCentavos } from '../../utils/currency';
import { FIXED_USER_ID } from '../../constants/user';
import { syncLinkedCreditDebt } from './creditSync';
import type { ILendingPaymentRepository } from '../ILendingPaymentRepository';
import type { LendingPayment, CreateLendingPaymentInput } from '../../domain/types';

function rowToPayment(row: any): LendingPayment {
  return {
    id: row.id, userId: row.userId, lendingId: row.lendingId,
    date: row.date, amount: row.amount, accountId: row.accountId,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}

export class SqliteLendingPaymentRepository implements ILendingPaymentRepository {
  async list(): Promise<LendingPayment[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM lending_payments WHERE userId = ? AND deletedAt IS NULL ORDER BY date DESC`,
      [FIXED_USER_ID],
    );
    return rows.map(rowToPayment);
  }

  async listByLending(lendingId: string): Promise<LendingPayment[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM lending_payments WHERE lendingId = ? AND userId = ? AND deletedAt IS NULL ORDER BY date DESC`,
      [lendingId, FIXED_USER_ID],
    );
    return rows.map(rowToPayment);
  }

  async getById(id: string): Promise<LendingPayment | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM lending_payments WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [id, FIXED_USER_ID],
    );
    return row ? rowToPayment(row) : null;
  }

  async create(lendingId: string, input: CreateLendingPaymentInput): Promise<LendingPayment> {
    const db = await getDatabase();
    const id = newId();
    const now = nowIso();
    const amount = roundCentavos(input.amount);
    const lending = await db.getFirstAsync<any>(
      `SELECT outstandingBalance FROM lendings WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [lendingId, FIXED_USER_ID],
    );
    if (!lending) throw new Error(`Lending ${lendingId} not found`);
    if (amount > roundCentavos(lending.outstandingBalance)) throw new Error('Payment exceeds remaining amount owed');
    const account = await db.getFirstAsync<any>(
      `SELECT id FROM accounts WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [input.accountId, FIXED_USER_ID],
    );
    if (!account) throw new Error(`Account ${input.accountId} not found`);
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO lending_payments (id, userId, lendingId, date, amount, accountId, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
        [id, FIXED_USER_ID, lendingId, input.date, amount, input.accountId, now, now],
      );
      await db.runAsync(
        `UPDATE lendings SET
           outstandingBalance = MAX(0, outstandingBalance - ?),
           status = CASE WHEN (outstandingBalance - ?) <= 0 THEN 'Paid' ELSE status END,
           updatedAt = ?, isDirty = 1
         WHERE id = ? AND userId = ?`,
        [amount, amount, now, lendingId, FIXED_USER_ID],
      );
      // Payback credits the destination account.
      await db.runAsync(
        `UPDATE accounts SET currentBalance = currentBalance + ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [amount, now, input.accountId, FIXED_USER_ID],
      );
      await syncLinkedCreditDebt(db, input.accountId);
    });
    const created = await this.getById(id);
    if (!created) throw new Error('LendingPayment creation failed silently');
    return created;
  }

  async softDelete(id: string): Promise<void> {
    const payment = await this.getById(id);
    if (!payment) return;
    const db = await getDatabase();
    const now = nowIso();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE lending_payments SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [now, now, id, FIXED_USER_ID],
      );
      await db.runAsync(
        `UPDATE lendings SET
           outstandingBalance = outstandingBalance + ?,
           status = CASE WHEN status = 'Paid' THEN 'Active' ELSE status END,
           updatedAt = ?, isDirty = 1
         WHERE id = ? AND userId = ?`,
        [payment.amount, now, payment.lendingId, FIXED_USER_ID],
      );
      // Reverse the credit.
      await db.runAsync(
        `UPDATE accounts SET currentBalance = currentBalance - ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [payment.amount, now, payment.accountId, FIXED_USER_ID],
      );
      await syncLinkedCreditDebt(db, payment.accountId);
    });
  }
}
