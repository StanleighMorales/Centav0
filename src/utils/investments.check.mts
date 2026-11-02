// Self-check for investments.ts. Run directly:
//   node --experimental-strip-types src/utils/investments.check.mts
import assert from 'node:assert';
import { investmentStats, amountFromRoi, timeline, formatPct } from './investments.ts';

const ups = [
  { date: '2026-04-30', amount: 1200, stakePct: null },
  { date: '2026-10-05', amount: 2000, stakePct: 6 },
  { date: '2026-07-31', amount: 1800, stakePct: null },
];

// Paid with a target: ROI, net, latest stake from the newest update that has one, progress toward the target.
const paid = investmentStats({ amountPaid: 20000, stakePct: 5, expectedReturnPct: 50 }, ups);
assert.equal(paid.returned, 5000);
assert.equal(paid.roiPct, 25);
assert.equal(paid.net, -15000);
assert.equal(paid.stakePct, 6);
assert.equal(paid.progress, 0.5);

// Free stake: no ROI %, stake falls back to the one entered up front.
const free = investmentStats({ amountPaid: 0, stakePct: 5, expectedReturnPct: null }, [{ date: '2026-09-12', amount: 20000, stakePct: null }]);
assert.equal(free.roiPct, null);
assert.equal(free.stakePct, 5);
assert.equal(free.net, 20000);

// No updates, nothing returned.
assert.equal(investmentStats({ amountPaid: 100, stakePct: null, expectedReturnPct: null }, []).progress, 0);

// Percent entry converts to pesos against the amount paid.
assert.equal(amountFromRoi(20000, 25), 5000);

// Timeline is newest first with cumulative ROI.
const t = timeline(20000, ups);
assert.equal(t[0].date, '2026-10-05');
assert.equal(t[0].runningRoiPct, 25);
assert.equal(t[2].runningRoiPct, 6);
assert.equal(formatPct(12.34), '12.3%');

console.log('investments.check: ok');
