import type { Debt } from '../domain/types';

export type ScheduleStatus = 'paid' | 'due' | 'upcoming';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ScheduleMonth {
  index: number;
  dueDate: string;
  principal: number;
  interest: number;
  fee: number;
  amount: number;
  status: ScheduleStatus;
}

// Advances `iso` by `months`, clamping day-of-month to the last valid day
// of the target month (e.g. Jan 31 + 1 month -> Feb 28). Plain Date construction
// rolls over out-of-range days, so we explicitly compute and cap to the last
// valid day of the target month instead.
export function addMonthsClamped(iso: string, months: number): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = d.getMonth() + months;
  let day = d.getDate();

  // Clamp day to the last valid day of the target month
  // new Date(year, month + 1, 0) gives the last day of the month
  const lastDayOfTargetMonth = new Date(year, month + 1, 0).getDate();
  if (day > lastDayOfTargetMonth) {
    day = lastDayOfTargetMonth;
  }

  return new Date(
    year, month, day,
    d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds(),
  ).toISOString();
}

/** Builds the full month-by-month schedule for an installment loan. Empty array if the debt isn't a valid installment plan. */
export function buildSchedule(debt: Debt): ScheduleMonth[] {
  if (!debt.isInstallment || !debt.dueDate || !debt.termMonths || debt.termMonths <= 0) return [];
  const monthlyPayment = debt.monthlyPayment ?? 0;
  if (monthlyPayment <= 0) return [];
  const monthlyInterest = debt.monthlyInterest ?? 0;
  const fee = debt.installmentFee ?? 0;
  const term = debt.termMonths;

  const amounts = Array.from({ length: term }, (_, i) => monthlyPayment + monthlyInterest + (i === 0 ? fee : 0));
  // A loan added with its total repayable ends on that total, so the last month takes the centavos lost to rounding.
  // A bigger gap means the terms were edited afterwards, which isn't rounding.
  if (debt.totalRepayable != null) {
    const drift = debt.totalRepayable - amounts.reduce((sum, a) => sum + a, 0);
    if (Math.abs(drift) < 0.01 * term) amounts[term - 1] = round2(amounts[term - 1] + drift);
  }

  // A loan added with its total repayable counts paid months from what's left of that total.
  // Older loans count them from the principal alone.
  let monthsPaid: number;
  if (debt.outstandingBalance <= 0) {
    monthsPaid = term;
  } else if (debt.totalRepayable != null) {
    let paid = debt.totalRepayable - debt.outstandingBalance;
    monthsPaid = 0;
    while (monthsPaid < term && paid + 0.005 >= amounts[monthsPaid]) paid -= amounts[monthsPaid++];
  } else {
    monthsPaid = Math.min(
      term,
      Math.max(0, Math.floor((debt.originalAmount - debt.outstandingBalance + 0.005) / monthlyPayment)),
    );
  }

  const months: ScheduleMonth[] = [];
  for (let i = 0; i < term; i++) {
    const isFirst = i === 0;
    const monthFee = isFirst ? fee : 0;
    months.push({
      index: i,
      dueDate: addMonthsClamped(debt.dueDate, i),
      principal: round2(amounts[i] - monthlyInterest - monthFee),
      interest: monthlyInterest,
      fee: monthFee,
      amount: amounts[i],
      status: i < monthsPaid ? 'paid' : i === monthsPaid ? 'due' : 'upcoming',
    });
  }
  return months;
}

/** When the next payment falls: an installment loan moves on as months are paid, anything else keeps its due date. */
export function nextDueDate(debt: Debt): string | null {
  return buildSchedule(debt).find((m) => m.status !== 'paid')?.dueDate ?? debt.dueDate;
}

/** One payment owed in a given month: a single installment, or a lump-sum debt's balance. */
export interface DueRow {
  debt: Debt;
  dueDate: string;
  amount: number;
}

/**
 * What is actually owed across `debts` in the month containing `month`.
 *
 * An installment loan owes one scheduled payment per month of its term — not its whole
 * balance, and not only in its first month. Lump-sum debts (buildSchedule -> []) fall back
 * to the balance owed on their single due date. Installments already marked 'paid' are
 * excluded so they stop counting toward what the user still owes.
 *
 * A credit line with statements (keyed by debt id in `credit`) owes each statement's unpaid part in its due month.
 */
export function duesInMonth(
  debts: Debt[],
  month: Date,
  credit: Record<string, { dueDate: string; remaining: number }[]> = {},
): DueRow[] {
  const inMonth = (iso: string) => {
    const d = new Date(iso);
    return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
  };
  return debts.flatMap((debt) => {
    const statements = credit[debt.id];
    if (statements) {
      return statements
        .filter((s) => s.remaining > 0 && inMonth(s.dueDate))
        .map((s) => ({ debt, dueDate: s.dueDate, amount: s.remaining }));
    }
    if (debt.status === 'Paid') return [];
    const schedule = buildSchedule(debt);
    if (schedule.length > 0) {
      return schedule
        .filter((m) => m.status !== 'paid' && inMonth(m.dueDate))
        .map((m) => ({ debt, dueDate: m.dueDate, amount: m.amount }));
    }
    return debt.dueDate && inMonth(debt.dueDate)
      ? [{ debt, dueDate: debt.dueDate, amount: debt.outstandingBalance }]
      : [];
  });
}

/** Total amount paid over the loan's full term: (payment + interest) * term + one-time fee. */
export function wholeLoanTotal(debt: Debt): number {
  if (!debt.termMonths) return 0;
  if (debt.totalRepayable != null) return debt.totalRepayable;
  const monthlyPayment = debt.monthlyPayment ?? 0;
  const monthlyInterest = debt.monthlyInterest ?? 0;
  const fee = debt.installmentFee ?? 0;
  return (monthlyPayment + monthlyInterest) * debt.termMonths + fee;
}

/** What one scheduled payment costs: a loan added with its total repayable already folds interest into the payment. */
export function monthlyAmount(debt: Debt): number | null {
  if (debt.monthlyPayment == null) return null;
  return debt.totalRepayable != null ? debt.monthlyPayment + (debt.monthlyInterest ?? 0) : debt.monthlyPayment;
}

/** What to pay next: the rest of the month that's due, one-time fee included. Older loans stay on the plain monthly amount. */
export function nextPaymentAmount(debt: Debt): number | null {
  const schedule = buildSchedule(debt);
  const due = schedule.find((m) => m.status === 'due');
  if (debt.totalRepayable == null || !due) return monthlyAmount(debt);
  const paidMonths = schedule.slice(0, due.index).reduce((sum, m) => sum + m.amount, 0);
  return round2(due.amount - (debt.totalRepayable - debt.outstandingBalance - paidMonths));
}
