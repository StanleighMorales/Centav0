// Self-check for backupRules.ts. Run directly:
//   node --experimental-strip-types src/utils/backupRules.check.mts
import assert from 'node:assert';
import { attachmentDest, backupAgeLabel, backupIsStale } from './backupRules.ts';

const DOCS = 'file:///data/user/0/com.stanleighmorales.centav0/files';
const CACHE = 'file:///data/user/0/com.stanleighmorales.centav0/cache';

assert.deepStrictEqual(
  attachmentDest(`${DOCS}/receipts/abc-123.jpg`),
  { folder: 'receipts', name: 'abc-123.jpg' },
  'current receipt',
);
assert.deepStrictEqual(
  attachmentDest(`${CACHE}/ImagePicker/abc-123.jpeg`),
  { folder: 'receipts', name: 'abc-123.jpeg' },
  'older receipt left in the picker cache',
);
assert.deepStrictEqual(
  attachmentDest(`${DOCS}/contracts/abc-123.pdf`),
  { folder: 'contracts', name: 'abc-123.pdf' },
  'contract',
);
assert.strictEqual(attachmentDest(`${DOCS}/receipts/..`), null, 'never a parent folder');
assert.strictEqual(attachmentDest(`${DOCS}/receipts/..%2F..%2Fx.jpg`), null, 'no encoded path tricks');
assert.strictEqual(attachmentDest(`${DOCS}/SQLite/centav0.db`), null, 'not a file type we attach');
assert.strictEqual(attachmentDest(''), null, 'nothing to go on');

const now = new Date('2026-11-20T04:00:00.000Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

assert.strictEqual(backupIsStale(daysAgo(13), null, now), false, 'backup still fresh at 13 days');
assert.strictEqual(backupIsStale(daysAgo(14), null, now), true, 'backup stale at 14 days');
assert.strictEqual(backupIsStale(null, daysAgo(13), now), false, 'a new user gets 14 days before the first nudge');
assert.strictEqual(backupIsStale(null, daysAgo(14), now), true, 'never backed up, clock runs from the oldest transaction');
assert.strictEqual(backupIsStale(daysAgo(1), daysAgo(100), now), false, 'a backup beats the oldest transaction');
assert.strictEqual(backupIsStale(null, null, now), false, 'an empty app has nothing to back up');

assert.strictEqual(backupAgeLabel(null, now), 'No backup yet');
assert.strictEqual(backupAgeLabel(daysAgo(0), now), 'Last backup: today');
assert.strictEqual(backupAgeLabel(daysAgo(1), now), 'Last backup: 1 day ago');
assert.strictEqual(backupAgeLabel(daysAgo(23), now), 'Last backup: 23 days ago');

console.log('backupRules.ts: all checks passed');
