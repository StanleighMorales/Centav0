// Monthly statements for a credit line (Atome, credit cards). Pure, so the self-check runs in plain Node.

export type StatementStatus = 'paid' | 'overdue' | 'dueSoon' | 'due' | 'upcoming';

/** Theme colour per status. Only an overdue bill is red; what's owed but not due stays neutral. */
export const STATUS_COLOR = {
  paid: 'positive',
  overdue: 'negative',
  dueSoon: 'warning',
  due: 'textPrimary',
  upcoming: 'textMuted',
} as const satisfies Record<StatementStatus, string>;

export const STATUS_LABEL: Record<StatementStatus, string> = {
  paid: 'Paid',
  overdue: 'Overdue',
  dueSoon: 'Due soon',
  due: 'Due',
  upcoming: 'Upcoming',
};

export type Statement = {
  billDate: string;
  dueDate: string;
  amount: number;
  paid: number;
  remaining: number;
  status: StatementStatus;
};

export type StatementInput = {
  billDay: number;
  dueDay: number;
  /** Purchases on the bill day go on the next statement instead of that day's. */
  billDayNext: boolean;
  /** Purchases on the card; `months` null = pay in full on one statement. */
  charges: { amount: number; date: string; months: number | null }[];
  payments: { amount: number }[];
  /** What the card says is owed right now (limit − available). */
  owed: number;
  /** How to split what's owed beyond recorded purchases. Null fields: one month, next bill. */
  earlier: { months: number | null; firstBill: string | null };
  today: string;
};

// ponytail: Manila is fixed UTC+8 (no DST), same as utils/date.ts.
const OFFSET = 8 * 3600 * 1000;
const DAY = 24 * 3600 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

// Month index (year * 12 + month) and day of the month, in Manila.
function manila(iso: string): { mi: number; d: number } {
  const t = new Date(Date.parse(iso) + OFFSET);
  return { mi: t.getUTCFullYear() * 12 + t.getUTCMonth(), d: t.getUTCDate() };
}

// Manila midnight of `day` in month `mi`, clamped to the month's last day (bill day 31 → 28 Feb).
function dayIso(mi: number, day: number): string {
  const y = Math.floor(mi / 12);
  const m = mi % 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last)) - OFFSET).toISOString();
}

// Which statement month a purchase on `iso` lands on.
function billMonth(iso: string, billDay: number, billDayNext: boolean): number {
  const { mi, d } = manila(iso);
  return d < billDay || (d === billDay && !billDayNext) ? mi : mi + 1;
}

// Splits `amount` over `months` statements starting at `start`; the last piece takes the leftover centavos.
function spread(into: Map<number, number>, amount: number, months: number, start: number) {
  const n = Math.max(1, Math.floor(months));
  const piece = round2(amount / n);
  for (let i = 0; i < n; i++) {
    const part = i === n - 1 ? round2(amount - piece * (n - 1)) : piece;
    into.set(start + i, round2((into.get(start + i) ?? 0) + part));
  }
}

/** The next `count` bill dates from `today` on: choices for where an earlier balance starts. */
export function firstBillOptions(billDay: number, today: string, count: number): string[] {
  const start = billMonth(today, billDay, false);
  return Array.from({ length: count }, (_, i) => dayIso(start + i, billDay));
}

export function buildStatements(input: StatementInput): { statements: Statement[]; earlierAmount: number } {
  const { billDay, dueDay, billDayNext, charges, payments, owed, earlier, today } = input;
  const byMonth = new Map<number, number>();
  for (const c of charges) spread(byMonth, c.amount, c.months ?? 1, billMonth(c.date, billDay, billDayNext));

  // Whatever the card owes beyond recorded purchases is the earlier balance; a negative gap (money
  // moved into the card) already paid part of the bills.
  const charged = charges.reduce((s, c) => s + c.amount, 0);
  const paidIn = payments.reduce((s, p) => s + p.amount, 0);
  const gap = round2(owed - (charged - paidIn));
  if (gap > 0) {
    const start = earlier.firstBill ? manila(earlier.firstBill).mi : billMonth(today, billDay, false);
    spread(byMonth, gap, earlier.months ?? 1, start);
  }

  let credit = round2(paidIn + Math.max(0, -gap));
  const now = Date.parse(today);
  const statements = [...byMonth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([mi, amount]): Statement => {
      const paid = round2(Math.min(credit, amount));
      credit = round2(credit - paid);
      const remaining = round2(amount - paid);
      const billDate = dayIso(mi, billDay);
      const dueDate = dayIso(dueDay > billDay ? mi : mi + 1, dueDay);
      const due = Date.parse(dueDate);
      const status: StatementStatus =
        remaining <= 0 ? 'paid'
        : Date.parse(billDate) > now ? 'upcoming'
        : now >= due + DAY ? 'overdue'
        : due - now <= 7 * DAY ? 'dueSoon'
        : 'due';
      return { billDate, dueDate, amount, paid, remaining, status };
    });
  return { statements, earlierAmount: Math.max(0, gap) };
}

/** Billed-and-unpaid total, the overdue part of it, the latest billed statement, and the next unbilled one. */
export function summarize(statements: Statement[], today: string) {
  const now = Date.parse(today);
  const billed = statements.filter((s) => Date.parse(s.billDate) <= now);
  return {
    dueNow: round2(billed.reduce((s, x) => s + x.remaining, 0)),
    overdue: round2(billed.filter((s) => s.status === 'overdue').reduce((s, x) => s + x.remaining, 0)),
    current: billed[billed.length - 1],
    next: statements.find((s) => Date.parse(s.billDate) > now),
  };
}

type CreditAccountLike = {
  billDay: number | null;
  dueDay: number | null;
  billDayNextStatement: boolean;
  earlierBalanceMonths: number | null;
  earlierBalanceFirstBill: string | null;
};

/** Statements for a credit account, or null until it has both a bill day and a due day. */
export function statementsFor(
  account: CreditAccountLike,
  charges: { amount: number; date: string; installmentMonths: number | null }[],
  payments: { amount: number }[],
  owed: number,
  today: string,
) {
  if (account.billDay == null || account.dueDay == null) return null;
  return buildStatements({
    billDay: account.billDay,
    dueDay: account.dueDay,
    billDayNext: account.billDayNextStatement,
    charges: charges.map((c) => ({ amount: c.amount, date: c.date, months: c.installmentMonths })),
    payments,
    owed,
    earlier: { months: account.earlierBalanceMonths, firstBill: account.earlierBalanceFirstBill },
    today,
  });
}

/** One status for the whole credit line: overdue beats due, then this bill paid, then nothing billed yet. */
export function creditStatus(summary: ReturnType<typeof summarize>, owed: number): StatementStatus {
  if (summary.overdue > 0) return 'overdue';
  if (summary.dueNow > 0 && summary.current) return summary.current.status;
  if (summary.current || owed <= 0) return 'paid';
  return 'upcoming';
}
