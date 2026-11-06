// Self-check for loanTerms.ts. No test framework in this repo — run it directly:
//   node --experimental-strip-types src/utils/loanTerms.check.mts
import assert from 'node:assert';
import { flatLoanTerms, pastPayments } from './loanTerms.ts';

const base = { amount: 17500, months: 12, interestPct: 3.95, feePct: 0.2, oneTimeFee: 0, paidMonths: 2, paymentOverride: 0 };

{
  const t = flatLoanTerms(base);
  assert.strictEqual(t.monthlyPayment, 2184.58);
  assert.strictEqual(t.total, 26215);
  assert.strictEqual(t.interestAndFees, 8715, 'interest 8,295 + protection 420');
  assert.strictEqual(t.extra, 726.25);
  assert.strictEqual(t.principalPart, 1458.33);
  assert.strictEqual(t.remaining, 21845.84, 'two payments of 2,184.58 made');
}
{
  const t = flatLoanTerms({ ...base, paymentOverride: 2184.59, paidMonths: 0 });
  assert.strictEqual(t.monthlyPayment, 2184.59, "the lender's figure wins");
  assert.strictEqual(t.total, 26215.08);
  assert.strictEqual(t.remaining, t.total, 'nothing paid yet');
}
{
  const t = flatLoanTerms({ ...base, interestPct: 0, feePct: 0, oneTimeFee: 100, paidMonths: 1 });
  assert.strictEqual(t.total, 17600, 'no rates: principal plus the one-time fee');
  assert.strictEqual(t.remaining, 17600 - (1458.33 + 100), 'the fee is part of the first payment');
}
{
  const dues = ['2026-09-08T00:00:00.000Z', '2026-10-08T00:00:00.000Z'];
  assert.deepStrictEqual(pastPayments(dues, 2184.58, 0).map((x) => [x.date, x.amount]), [[dues[0], 2184.58], [dues[1], 2184.58]]);
  assert.strictEqual(pastPayments(dues, 100, 50)[0].amount, 150, 'the one-time fee is on the first payment only');
  assert.strictEqual(pastPayments(dues, 100, 50)[1].amount, 100);
  assert.deepStrictEqual(pastPayments([], 100, 0), []);
}

console.log('loanTerms.ts: all checks passed');
