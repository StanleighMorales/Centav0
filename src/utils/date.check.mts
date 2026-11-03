// Self-check for date.ts. No test framework in this repo — run it directly:
//   node --experimental-strip-types src/utils/date.check.mts
import assert from 'node:assert';
import { groupByMonth } from './date.ts';

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

console.log('date.ts: all checks passed');
