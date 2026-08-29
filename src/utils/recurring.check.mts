// Self-check for recurring.ts. No test framework in this repo — run it directly:
//   node --experimental-strip-types src/utils/recurring.check.mts
import assert from 'node:assert';
import { nextOccurrences, type RecurringRule } from './recurring.ts';

// Occurrence ISO strings encode Manila midnight, which in raw UTC is the previous
// calendar day (UTC+8 subtracted) — read them back the same Manila-shifted way.
const MANILA_OFFSET = 8 * 60 * 60 * 1000;
const manilaDate = (iso: string) => new Date(new Date(iso).getTime() + MANILA_OFFSET).getUTCDate();
const manilaDay = (iso: string) => new Date(new Date(iso).getTime() + MANILA_OFFSET).getUTCDay();

// Monthly, month-end clamping: dayOfMonth=31 lands on Feb 28 in a non-leap year.
{
  const rule: RecurringRule = { frequency: 'monthly', dayOfMonth: 31, startDate: '2026-01-01T00:00:00.000Z' };
  const occurrences = nextOccurrences(rule, null, '2026-04-01T00:00:00.000Z');
  assert.strictEqual(occurrences.length, 3, 'Jan, Feb, Mar all produce an occurrence');
  assert.strictEqual(manilaDate(occurrences[0]), 31, 'Jan clamps to 31 (has 31 days)');
  assert.strictEqual(manilaDate(occurrences[1]), 28, 'Feb 2026 (non-leap) clamps 31 -> 28');
  assert.strictEqual(manilaDate(occurrences[2]), 31, 'Mar clamps to 31');
}

// Semi-monthly, "30 = last day" sentinel, across a month boundary.
{
  const rule: RecurringRule = { frequency: 'semi-monthly', semiMonthDays: [15, 30], startDate: '2026-01-01T00:00:00.000Z' };
  const occurrences = nextOccurrences(rule, null, '2026-02-28T00:00:00.000Z');
  assert.strictEqual(occurrences.length, 4, 'two paydays x two months');
  assert.strictEqual(manilaDate(occurrences[0]), 15, 'Jan 15');
  assert.strictEqual(manilaDate(occurrences[1]), 31, 'Jan 30-sentinel clamps to 31 (Jan has 31 days)');
  assert.strictEqual(manilaDate(occurrences[2]), 15, 'Feb 15');
  assert.strictEqual(manilaDate(occurrences[3]), 28, 'Feb 30-sentinel clamps to 28 (non-leap Feb)');
}

// Weekly, specific day-of-week.
{
  // 2026-01-05 is a Monday (dayOfWeek=1).
  const rule: RecurringRule = { frequency: 'weekly', dayOfWeek: 1, startDate: '2026-01-05T00:00:00.000Z' };
  const occurrences = nextOccurrences(rule, null, '2026-01-26T00:00:00.000Z');
  assert.strictEqual(occurrences.length, 4, 'four Mondays in the range');
  for (const iso of occurrences) {
    assert.strictEqual(manilaDay(iso), 1, 'every occurrence is a Monday');
  }
}

// Catch-up after a long gap does not double-post: calling twice with the returned
// last date as the new `since` produces zero overlap.
{
  const rule: RecurringRule = { frequency: 'monthly', dayOfMonth: 1, startDate: '2026-01-01T00:00:00.000Z' };
  const today = '2026-06-01T00:00:00.000Z';
  const firstRun = nextOccurrences(rule, null, today);
  assert.strictEqual(firstRun.length, 6, 'Jan through Jun, six occurrences');
  const lastMaterialized = firstRun[firstRun.length - 1];
  const secondRun = nextOccurrences(rule, lastMaterialized, today);
  assert.strictEqual(secondRun.length, 0, 're-running with an advanced `since` posts nothing new');
}

// endDate excludes anything after it.
{
  const rule: RecurringRule = {
    frequency: 'monthly', dayOfMonth: 1,
    startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-03-01T00:00:00.000Z',
  };
  const occurrences = nextOccurrences(rule, null, '2026-06-01T00:00:00.000Z');
  assert.strictEqual(occurrences.length, 3, 'stops at endDate even though today is later');
}

console.log('recurring.ts: all checks passed');
