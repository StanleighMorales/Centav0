import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { roundCentavos } from '../../utils/currency';
import { FIXED_USER_ID } from '../../constants/user';
import type { DebtPaymentFilter, IDebtPaymentRepository } from '../IDebtPaymentRepository';
import type { DebtPayment, CreateDebtPaymentInput } from '../../domain/types';

function rowToPayment(row: any): DebtPayment {
  return {
    id: row.id, userId: row.userId, debtId: row.debtId,
    date: row.date, amount: row.amount, accountId: row.accountId,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}

export class SqliteDebtPaymentRepository implements IDebtPaymentRepository {
  async list(filter?: DebtPaymentFilter): Promise<DebtPayment[]> {
    const db = await getDatabase();
    const conditions = ['userId = ?', 'deletedAt IS NULL'];
    const params: any[] = [FIXED_USER_ID];
    if (filter?.from) { conditions.push('date >= ?'); params.push(filter.from); }
    if (filter?.to) { conditions.push('date <= ?'); params.push(filter.to); }
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM debt_payments WHERE ${conditions.join(' AND ')} ORDER BY date DESC`,
      params,
    );
    return rows.map(rowToPayment);
  }

  async listByDebt(debtId: string): Promise<DebtPayment[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM debt_payments WHERE debtId = ? AND userId = ? AND deletedAt IS NULL ORDER BY date DESC`,
      [debtId, FIXED_USER_ID],
    );
    return rows.map(rowToPayment);
  }

  async getById(id: string): Promise<DebtPayment | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM debt_payments WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [id, FIXED_USER_ID],
    );
    return row ? rowToPayment(row) : null;
  }

  async create(debtId: string, input: CreateDebtPaymentInput): Promise<DebtPayment> {
    const db = await getDatabase();
    const id = newId();
    const now = nowIso();
    const amount = roundCentavos(input.amount);
    const debt = await db.getFirstAsync<any>(
      `SELECT outstandingBalance FROM debts WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [debtId, FIXED_USER_ID],
    );
    if (!debt) throw new Error(`Debt ${debtId} not found`);
    if (amount > roundCentavos(debt.outstandingBalance)) throw new Error('Payment exceeds remaining debt');
    const account = await db.getFirstAsync<any>(
      `SELECT currentBalance, allowsOverdraft FROM accounts WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [input.accountId, FIXED_USER_ID],
    );
    if (!account) throw new Error(`Account ${input.accountId} not found`);
    // Overdraft-capable accounts may go negative — that's spending credit to pay the debt.
    if (!account.allowsOverdraft && amount > roundCentavos(account.currentBalance)) {
      throw new Error('Payment exceeds account balance');
    }
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO debt_payments (id, userId, debtId, date, amount, accountId, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
        [id, FIXED_USER_ID, debtId, input.date, amount, input.accountId, now, now],
      );
      // Deduct from outstanding balance; mark Paid if it reaches zero
      await db.runAsync(
        `UPDATE debts SET
           outstandingBalance = MAX(0, outstandingBalance - ?),
           status = CASE WHEN (outstandingBalance - ?) <= 0 THEN 'Paid' ELSE status END,
           updatedAt = ?, isDirty = 1
         WHERE id = ? AND userId = ?`,
        [amount, amount, now, debtId, FIXED_USER_ID],
      );
      // Deduct payment from account
      await db.runAsync(
        `UPDATE accounts SET currentBalance = currentBalance - ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [amount, now, input.accountId, FIXED_USER_ID],
      );
    });
    const created = await this.getById(id);
    if (!created) throw new Error('DebtPayment creation failed silently');
    return created;
  }

  async softDelete(id: string): Promise<void> {
    const payment = await this.getById(id);
    if (!payment) return;
    const db = await getDatabase();
    const now = nowIso();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE debt_payments SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [now, now, id, FIXED_USER_ID],
      );
      // Restore outstanding balance and reopen debt
      await db.runAsync(
        `UPDATE debts SET
           outstandingBalance = outstandingBalance + ?,
           status = CASE WHEN status = 'Paid' THEN 'Open' ELSE status END,
           updatedAt = ?, isDirty = 1
         WHERE id = ? AND userId = ?`,
        [payment.amount, now, payment.debtId, FIXED_USER_ID],
      );
      // Restore account balance
      await db.runAsync(
        `UPDATE accounts SET currentBalance = currentBalance + ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [payment.amount, now, payment.accountId, FIXED_USER_ID],
      );
    });
  }
}
