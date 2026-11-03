// Self-check for receipt.ts. No test framework in this repo — run it directly:
//   node --experimental-strip-types src/utils/receipt.check.mts
import assert from 'node:assert';
import { parseReceipt } from './receipt.ts';

const grocery = parseReceipt([
  'MERCURY DRUG',
  'SM City Cebu',
  '03/11/2026 14:22',
  'Paracetamol 500mg   45.00',
  '2 x Vitamin C   120.50',
  'Alcohol 70%   1,085.25',
  'SUBTOTAL   1,250.75',
  'VAT 12%   134.00',
  'TOTAL   1,250.75',
  'CASH   2,000.00',
  'CHANGE   749.25',
]);
assert.strictEqual(grocery.merchant, 'MERCURY DRUG');
assert.strictEqual(grocery.total, 1250.75);
assert.deepStrictEqual(grocery.items, [
  { name: 'Paracetamol 500mg', qty: 1, price: 45 },
  { name: 'Vitamin C', qty: 2, price: 120.5 },
  { name: 'Alcohol 70%', qty: 1, price: 1085.25 },
]);
assert.ok(grocery.date?.startsWith('2026-11-03'), grocery.date ?? 'no date'); // day-first

// No TOTAL line: falls back to the largest amount.
assert.strictEqual(parseReceipt(['Cafe', 'Latte 150.00', 'Cake 95.00']).total, 150);

// ISO date.
assert.ok(parseReceipt(['Shop', '2026-01-09']).date?.startsWith('2026-01-09'));

// Nothing parseable: empty, never throws.
const empty = parseReceipt(['', '???']);
assert.deepStrictEqual([empty.total, empty.date, empty.items.length], [null, null, 0]);

console.log('receipt.ts: all checks passed');
