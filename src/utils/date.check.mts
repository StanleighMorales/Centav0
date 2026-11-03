// Self-check for date.ts. No test framework in this repo — run it directly:
//   node --experimental-strip-types src/utils/date.check.mts
import assert from 'node:assert';
import { paidForDue } from './date.ts';

// Card bill due 18 Nov 2026 (Manila midnight). The previous bill was due 18 Oct.
const due = '2026-11-17T16:00:00.000Z';
assert.strictEqual(paidForDue(due, ['2026-11-03T09:00:00.000Z']), true, 'paid early in November');
assert.strictEqual(paidForDue(due, ['2026-10-25T02:00:00.000Z']), true, 'paid after the October due date');
assert.strictEqual(paidForDue(due, ['2026-10-18T02:00:00.000Z']), false, 'paid on 18 Oct: that was the October bill');
assert.strictEqual(paidForDue(due, ['2026-09-30T02:00:00.000Z']), false, 'only an older payment');
assert.strictEqual(paidForDue(due, []), false, 'no payments');

console.log('date.ts: all checks passed');
