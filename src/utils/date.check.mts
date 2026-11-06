// Self-check for date.ts. No test framework in this repo — run it directly:
//   node --experimental-strip-types src/utils/date.check.mts
import assert from 'node:assert';
import { groupByMonth, inRange, periodRangeIso } from './date.ts';

// Mid-month dates, so the machine's time zone can't move them across a month line.
const groups = groupByMonth([
  { date: '2026-11-15T04:00:00.000Z', amount: 0.1 },
  { date: '2026-11-10T04:00:00.000Z', amount: 0.2 },
  { date: '2026-10-20T04:00:00.000Z', amount: 2516.13 },
]);
assert.deepStrictEqual(
  groups.map((g) => [g.key, g.items.length, g.total]),
  [['2026-11', 2, 0.3], ['2026-10', 1, 2516.13]],
  'newest month first, totals rounded to centavos',
);
assert.deepStrictEqual(groupByMonth([]), [], 'nothing to group');

// A period runs from Manila midnight to its last millisecond, compared on the full timestamp.
{
  const today = periodRangeIso('day', new Date('2026-11-06T02:00:00.000Z'));
  assert.ok(inRange('2026-11-06T02:00:00.000Z', today), 'this morning');
  assert.ok(inRange('2026-11-05T16:00:00.000Z', today), 'Manila midnight');
  assert.ok(inRange('2026-11-06T15:59:59.999Z', today), 'last moment of the day');
  assert.ok(!inRange('2026-11-05T15:59:59.999Z', today), 'yesterday');
  assert.ok(!inRange('2026-11-06T16:00:00.000Z', today), 'tomorrow');
}

console.log('date.ts: all checks passed');
