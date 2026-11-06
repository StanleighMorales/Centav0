import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { roundCentavos } from '../../utils/currency';
import { FIXED_USER_ID } from '../../constants/user';
import { syncLinkedCreditDebt } from './creditSync';
import { addMonthsClamped, nextDueDate } from '../../utils/installmentSchedule';
import type { Debt, CreateDebtInput, UpdateDebtInput, DebtStatus } from '../../domain/types';

function rowToDebt(row: any): Debt {
  return {
    id: row.id, userId: row.userId, creditor: row.creditor,
    originalAmount: row.originalAmount, outstandingBalance: row.outstandingBalance,
    dueDate: row.dueDate ?? null, status: row.status,
    debtType: row.debtType, disbursementAccountId: row.disbursementAccountId ?? null,
    linkedAccountId: row.linkedAccountId ?? null,
    disbursementTransactionId: row.disbursementTransactionId ?? null,
    interestRate: row.interestRate ?? null, note: row.note ?? null,
    isInstallment: row.isInstallment === 1,
    monthlyPayment: row.monthlyPayment ?? null,
    installmentFee: row.installmentFee ?? null,
    termMonths: row.termMonths ?? null,
    monthlyInterest: row.monthlyInterest ?? null,
    totalRepayable: row.totalRepayable ?? null,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}

export function computeStatus(outstandingBalance: number, dueDate: string | null): DebtStatus {
  if (outstandingBalance <= 0) return 'Paid';
  if (dueDate && dueDate < nowIso().slice(0, 10)) return 'Overdue';
  return 'Open';
}

// Get-or-create rather than a seeded migration row, so the category can't be
// deleted out from under this feature before the user ever takes a loan.
async function getOrCreateLoanCategory(db: Awaited<ReturnType<typeof getDatabase>>): Promise<string> {
  const existing = await db.getFirstAsync<any>(
    `SELECT id FROM categories WHERE userId = ? AND type = 'Income' AND name = 'Loan' AND deletedAt IS NULL`,
    [FIXED_USER_ID],
  );
  if (existing) return existing.id;
  const id = newId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO categories (id, userId, name, type, icon, color, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
     VALUES (?, ?, 'Loan', 'Income', 'trending-up', '#0ea5e9', ?, ?, NULL, 1, NULL)`,
    [id, FIXED_USER_ID, now, now],
  );
  return id;
}

export class SqliteDebtRepository {
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
    const past = input.pastPayments ?? [];
    const owed = input.totalRepayable != null
      ? Math.max(0, roundCentavos(input.totalRepayable - past.reduce((sum, p) => sum + p.amount, 0)))
      : amount;
    // Months already paid move the next due date on; the first due date alone would read as overdue.
    const nextDue = dueDate && past.length > 0 && input.termMonths && past.length < input.termMonths
      ? addMonthsClamped(dueDate, past.length)
      : dueDate;
    const status = computeStatus(owed, nextDue);
    const isLoan = input.debtType === 'Loan';
    // A loan already sitting in an account is tracked without paying it out again.
    const disburse = isLoan && !input.alreadyReceived;
    if (disburse && !input.accountId) throw new Error('Select an account to receive the loan');
    const disbursementAccountId = disburse ? input.accountId! : null;
    const disbursementTransactionId = disburse ? newId() : null;
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO debts (id, userId, creditor, originalAmount, outstandingBalance, dueDate, status, debtType, disbursementAccountId, disbursementTransactionId, interestRate, note, isInstallment, monthlyPayment, installmentFee, termMonths, monthlyInterest, totalRepayable, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
        [
          id, FIXED_USER_ID, input.creditor, amount, owed, dueDate, status,
          input.debtType, disbursementAccountId, disbursementTransactionId,
          input.interestRate ?? null, input.note ?? null,
          input.isInstallment ? 1 : 0, input.monthlyPayment ?? null, input.installmentFee ?? null,
          input.termMonths ?? null, input.monthlyInterest ?? null, input.totalRepayable ?? null,
          now, now,
        ],
      );
      // No account: paid before tracking, so it's history only.
      for (const p of past) {
        await db.runAsync(
          `INSERT INTO debt_payments (id, userId, debtId, date, amount, accountId, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
           VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NULL, 1, NULL)`,
          [newId(), FIXED_USER_ID, id, p.date, roundCentavos(p.amount), now, now],
        );
      }
      if (disburse) {
        const categoryId = await getOrCreateLoanCategory(db);
        await db.runAsync(
          `INSERT INTO transactions (id, userId, date, amount, type, categoryId, accountId, toAccountId, note, receiptUri, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
           VALUES (?, ?, ?, ?, 'Income', ?, ?, NULL, ?, NULL, ?, ?, NULL, 1, NULL)`,
          [disbursementTransactionId, FIXED_USER_ID, now, amount, categoryId, disbursementAccountId, `Loan from ${input.creditor}`, now, now],
        );
        await db.runAsync(
          `UPDATE accounts SET currentBalance = currentBalance + ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
          [amount, now, disbursementAccountId, FIXED_USER_ID],
        );
        await syncLinkedCreditDebt(db, disbursementAccountId!);
      }
    });
    const created = await this.getById(id);
    if (!created) throw new Error('Debt creation failed silently');
    return created;
  }

  async update(id: string, input: UpdateDebtInput): Promise<Debt> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Debt ${id} not found`);
    const db = await getDatabase();
    const now = nowIso();
    const next: Debt = {
      ...existing,
      dueDate: 'dueDate' in input ? (input.dueDate ?? null) : existing.dueDate,
      isInstallment: 'isInstallment' in input ? !!input.isInstallment : existing.isInstallment,
      monthlyPayment: 'monthlyPayment' in input ? (input.monthlyPayment ?? null) : existing.monthlyPayment,
      installmentFee: 'installmentFee' in input ? (input.installmentFee ?? null) : existing.installmentFee,
      termMonths: 'termMonths' in input ? (input.termMonths ?? null) : existing.termMonths,
      monthlyInterest: 'monthlyInterest' in input ? (input.monthlyInterest ?? null) : existing.monthlyInterest,
    };
    const status = computeStatus(existing.outstandingBalance, nextDueDate(next));
    await db.runAsync(
      `UPDATE debts SET creditor = ?, dueDate = ?, status = ?, interestRate = ?, note = ?, isInstallment = ?, monthlyPayment = ?, installmentFee = ?, termMonths = ?, monthlyInterest = ?, updatedAt = ?, isDirty = 1
       WHERE id = ? AND userId = ?`,
      [
        input.creditor ?? existing.creditor, next.dueDate, status,
        'interestRate' in input ? (input.interestRate ?? null) : existing.interestRate,
        'note' in input ? (input.note ?? null) : existing.note,
        next.isInstallment ? 1 : 0, next.monthlyPayment, next.installmentFee, next.termMonths, next.monthlyInterest,
        now, id, FIXED_USER_ID,
      ],
    );
    const updated = await this.getById(id);
    if (!updated) throw new Error('Debt vanished after update');
    return updated;
  }

  async markPaid(id: string): Promise<Debt> {
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE debts SET outstandingBalance = 0, status = 'Paid', updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [now, id, FIXED_USER_ID],
    );
    const updated = await this.getById(id);
    if (!updated) throw new Error('Debt vanished after markPaid');
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) return;
    const db = await getDatabase();
    const now = nowIso();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE debts SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [now, now, id, FIXED_USER_ID],
      );
      if (existing.disbursementAccountId) {
        if (existing.disbursementTransactionId) {
          await db.runAsync(
            `UPDATE transactions SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
            [now, now, existing.disbursementTransactionId, FIXED_USER_ID],
          );
        }
        await db.runAsync(
          `UPDATE accounts SET currentBalance = currentBalance - ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
          [existing.originalAmount, now, existing.disbursementAccountId, FIXED_USER_ID],
        );
        await syncLinkedCreditDebt(db, existing.disbursementAccountId);
      }
    });
  }
}
