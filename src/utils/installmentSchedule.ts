import type { Debt } from '../domain/types';

export type ScheduleStatus = 'paid' | 'due' | 'upcoming';

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
function addMonthsClamped(iso: string, months: number): string {
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

  const monthsPaid = Math.min(
    debt.termMonths,
    Math.max(0, Math.floor((debt.originalAmount - debt.outstandingBalance) / monthlyPayment)),
  );

  const months: ScheduleMonth[] = [];
  for (let i = 0; i < debt.termMonths; i++) {
    const isFirst = i === 0;
    const monthFee = isFirst ? fee : 0;
    months.push({
      index: i,
      dueDate: addMonthsClamped(debt.dueDate, i),
      principal: monthlyPayment,
      interest: monthlyInterest,
      fee: monthFee,
      amount: monthlyPayment + monthlyInterest + monthFee,
      status: i < monthsPaid ? 'paid' : i === monthsPaid ? 'due' : 'upcoming',
    });
  }
  return months;
}

/** Total amount paid over the loan's full term: (payment + interest) * term + one-time fee. */
export function wholeLoanTotal(debt: Debt): number {
  if (!debt.termMonths) return 0;
  const monthlyPayment = debt.monthlyPayment ?? 0;
  const monthlyInterest = debt.monthlyInterest ?? 0;
  const fee = debt.installmentFee ?? 0;
  return (monthlyPayment + monthlyInterest) * debt.termMonths + fee;
}
