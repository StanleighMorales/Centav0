export type Frequency = 'weekly' | 'monthly' | 'semi-monthly';

export interface RecurringRule {
  frequency: Frequency;
  dayOfMonth?: number | null;       // monthly, 1-31 (clamped to month length)
  semiMonthDays?: number[] | null;  // semi-monthly, e.g. [15, 30] where 30+ means "last day"
  dayOfWeek?: number | null;        // weekly, 0=Sun..6=Sat
  startDate: string;                // ISO — first eligible occurrence
  endDate?: string | null;          // ISO — last eligible occurrence, inclusive
}

type YMD = { y: number; m: number; d: number };

// ponytail: Manila is fixed UTC+8 (no DST) — same offset trick as date.ts's
// manilaParts/dayStart, duplicated here so this file stays a standalone runtime
// module the .check.mts self-check can import without a cross-file ESM resolve.
const MANILA_OFFSET = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Which Manila calendar day a real-world instant falls on.
function manilaParts(iso: string): YMD {
  const shifted = new Date(new Date(iso).getTime() + MANILA_OFFSET);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

// The instant representing Manila midnight of a given calendar day.
const dayStart = ({ y, m, d }: YMD) => new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - MANILA_OFFSET).toISOString();

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
// Comparable integer for a calendar day — d is always <100 and m always <100.
const dayNum = ({ y, m, d }: YMD) => y * 10000 + m * 100 + d;

/**
 * Every occurrence of `rule` that falls on/after its startDate, on/before `todayIso`,
 * and strictly after `sinceIso` (the last date already materialized, or null if none
 * yet). Calling this again with `sinceIso` advanced to the latest returned date is
 * idempotent — it never re-includes a date already passed. All comparisons are done
 * on calendar days (not raw instants) so a Manila-midnight-shifted candidate never
 * misses a same-day boundary by a few hours.
 */
export function nextOccurrences(rule: RecurringRule, sinceIso: string | null, todayIso: string): string[] {
  const startP = manilaParts(rule.startDate);
  const todayP = manilaParts(todayIso);
  const sinceNum = sinceIso ? dayNum(manilaParts(sinceIso)) : null;
  const endNum = rule.endDate ? dayNum(manilaParts(rule.endDate)) : null;
  const startNum = dayNum(startP);
  const todayNum = dayNum(todayP);
  const results: string[] = [];

  function accept(ymd: YMD) {
    const n = dayNum(ymd);
    if (n < startNum || n > todayNum) return;
    if (sinceNum !== null && n <= sinceNum) return;
    if (endNum !== null && n > endNum) return;
    results.push(dayStart(ymd));
  }

  if (rule.frequency === 'weekly') {
    const dow = rule.dayOfWeek ?? 0;
    let cursor = startP;
    while (dayNum(cursor) <= todayNum) {
      if (new Date(Date.UTC(cursor.y, cursor.m, cursor.d)).getUTCDay() === dow) accept(cursor);
      const next = new Date(Date.UTC(cursor.y, cursor.m, cursor.d) + DAY_MS);
      cursor = { y: next.getUTCFullYear(), m: next.getUTCMonth(), d: next.getUTCDate() };
    }
    return results;
  }

  const days = (rule.frequency === 'monthly' ? [rule.dayOfMonth ?? 1] : [...(rule.semiMonthDays ?? [])])
    .slice()
    .sort((a, b) => a - b);
  for (let key = startP.y * 12 + startP.m; key <= todayP.y * 12 + todayP.m; key++) {
    const y = Math.floor(key / 12);
    const m = key % 12;
    const last = daysInMonth(y, m);
    for (const day of days) {
      // Semi-monthly's 30 is a sentinel for "last day of month" (payroll's second
      // payday), not a literal day-30 clamped down — so it resolves to 31 in a
      // 31-day month. Monthly's dayOfMonth is a literal day, only clamped when
      // the month is too short for it.
      const resolvedDay = rule.frequency === 'semi-monthly' && day >= 30 ? last : Math.min(day, last);
      accept({ y, m, d: resolvedDay });
    }
  }
  return results;
}
