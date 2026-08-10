// Self-check for installmentSchedule.ts. No test framework in this repo — run it directly:
//   node --experimental-strip-types src/utils/installmentSchedule.check.mts
import assert from 'node:assert';
import { buildSchedule, wholeLoanTotal, type ScheduleMonth } from './installmentSchedule.ts';
import type { Debt } from '../domain/types.ts';

function makeDebt(overrides: Partial<Debt>): Debt {
  return {
    id: 'd1', userId: 'u1', creditor: 'Test Lender',
    originalAmount: 10000, outstandingBalance: 10000,
    dueDate: '2026-01-15T00:00:00.000Z', status: 'Open', debtType: 'Loan',
    disbursementAccountId: null, linkedAccountId: null, disbursementTransactionId: null,
    interestRate: null, note: null,
    isInstallment: true, monthlyPayment: 2000, installmentFee: 100,
    termMonths: 5, monthlyInterest: 50,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null, isDirty: false, syncedAt: null,
    ...overrides,
  };
}

// Basic shape: 5 months, ascending due dates one month apart.
{
  const schedule = buildSchedule(makeDebt({}));
  assert.strictEqual(schedule.length, 5, 'termMonths=5 produces 5 rows');
  assert.strictEqual(new Date(schedule[0].dueDate).getMonth(), 0, 'month 0 due in Jan');
  assert.strictEqual(new Date(schedule[1].dueDate).getMonth(), 1, 'month 1 due in Feb');
  assert.strictEqual(new Date(schedule[4].dueDate).getMonth(), 4, 'month 4 due in May');
}

// Fee folds into month 0 only.
{
  const schedule = buildSchedule(makeDebt({}));
  assert.strictEqual(schedule[0].amount, 2000 + 50 + 100, 'month 0 includes fee');
  assert.strictEqual(schedule[1].amount, 2000 + 50, 'month 1 excludes fee');
}

// monthsPaid derived from originalAmount - outstandingBalance.
{
  // 2 payments of 2000 made: outstandingBalance dropped from 10000 to 6000.
  const schedule = buildSchedule(makeDebt({ outstandingBalance: 6000 }));
  assert.strictEqual(schedule[0].status, 'paid');
  assert.strictEqual(schedule[1].status, 'paid');
  assert.strictEqual(schedule[2].status, 'due');
  assert.strictEqual(schedule[3].status, 'upcoming');
  assert.strictEqual(schedule[4].status, 'upcoming');
}

// monthsPaid clamps at termMonths even if outstandingBalance overshoots to 0.
{
  const schedule = buildSchedule(makeDebt({ outstandingBalance: 0 }));
  assert.ok(schedule.every((m) => m.status === 'paid'), 'fully paid loan marks every month paid');
}

// Non-installment or missing term/payment yields an empty schedule.
{
  assert.deepStrictEqual(buildSchedule(makeDebt({ isInstallment: false })), []);
  assert.deepStrictEqual(buildSchedule(makeDebt({ termMonths: null })), []);
  assert.deepStrictEqual(buildSchedule(makeDebt({ monthlyPayment: null })), []);
  assert.deepStrictEqual(buildSchedule(makeDebt({ monthlyPayment: 0 })), []);
  assert.deepStrictEqual(buildSchedule(makeDebt({ dueDate: null })), []);
}

// Day-of-month clamps across shorter months (Jan 31 -> Feb 28).
{
  const schedule = buildSchedule(makeDebt({ dueDate: '2026-01-31T00:00:00.000Z', termMonths: 2 }));
  const feb = new Date(schedule[1].dueDate);
  assert.strictEqual(feb.getMonth(), 1, 'clamped date still lands in February');
  assert.ok(feb.getDate() <= 28, 'clamped to a valid February day');
}

// Whole-loan total: (payment + interest) * term + one-time fee.
{
  const total = wholeLoanTotal(makeDebt({}));
  assert.strictEqual(total, (2000 + 50) * 5 + 100);
}

console.log('installmentSchedule.ts: all checks passed');
