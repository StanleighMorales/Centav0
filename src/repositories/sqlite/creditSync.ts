import type * as SQLite from 'expo-sqlite';
import { nowIso, nextDueDateIso } from '../../utils/date';
import { roundCentavos } from '../../utils/currency';
import { FIXED_USER_ID } from '../../constants/user';
import { computeStatus } from './SqliteDebtRepository';

/**
 * Re-derives a Credit Card account's linked debt (if any) from its current
 * balance. currentBalance is the *available* credit remaining (starts at
 * creditLimit, decreases as spent), so amount owed = creditLimit -
 * currentBalance. dueDate = next occurrence of the account's dueDay.
 * No-op if the account has no linked debt.
 */
export async function syncLinkedCreditDebt(db: SQLite.SQLiteDatabase, accountId: string): Promise<void> {
  const debt = await db.getFirstAsync<any>(
    `SELECT id FROM debts WHERE linkedAccountId = ? AND userId = ? AND deletedAt IS NULL`,
    [accountId, FIXED_USER_ID],
  );
  if (!debt) return;
  const account = await db.getFirstAsync<any>(
    `SELECT currentBalance, dueDay, creditLimit FROM accounts WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
    [accountId, FIXED_USER_ID],
  );
  if (!account) return;
  const limit = account.creditLimit ?? 0;
  const owed = roundCentavos(Math.min(limit, Math.max(0, limit - account.currentBalance)));
  const dueDate = account.dueDay != null ? nextDueDateIso(account.dueDay) : null;
  const status = computeStatus(owed, dueDate);
  await db.runAsync(
    `UPDATE debts SET originalAmount = ?, outstandingBalance = ?, dueDate = ?, status = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
    [owed, owed, dueDate, status, nowIso(), debt.id, FIXED_USER_ID],
  );
}
