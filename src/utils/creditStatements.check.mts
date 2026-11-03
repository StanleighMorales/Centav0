// Self-check for creditStatements.ts. No test framework in this repo — run it directly:
//   node --experimental-strip-types src/utils/creditStatements.check.mts
import assert from 'node:assert';
import { buildStatements, creditStatus, firstBillOptions, summarize } from './creditStatements.ts';

// Manila noon on a day, as a UTC ISO string.
const at = (ymd: string) => new Date(`${ymd}T04:00:00.000Z`).toISOString();
// Manila midnight, the way bill and due dates are stored.
const day = (ymd: string) => new Date(Date.parse(`${ymd}T00:00:00.000Z`) - 8 * 3600 * 1000).toISOString();

const atome = { billDay: 8, dueDay: 15, billDayNext: false };
const none = { months: null, firstBill: null };
const base = { ...atome, payments: [], earlier: none, today: at('2026-11-04') };
const owedOf = (charges: { amount: number }[]) => charges.reduce((s, c) => s + c.amount, 0);

{
  // The user's example: bill 8, due 15.
  const charges = [
    { amount: 100, date: at('2026-11-07'), months: null },
    { amount: 200, date: at('2026-11-08'), months: null },
    { amount: 400, date: at('2026-11-09'), months: null },
  ];
  const { statements } = buildStatements({ ...base, charges, owed: owedOf(charges) });
  assert.deepStrictEqual(statements.map((s) => [s.billDate, s.dueDate, s.amount]), [
    [day('2026-11-08'), day('2026-11-15'), 300],
    [day('2026-12-08'), day('2026-12-15'), 400],
  ], 'bought on the 7th or 8th → Nov bill; on the 9th → Dec bill');

  const next = buildStatements({ ...base, billDayNext: true, charges, owed: owedOf(charges) }).statements;
  assert.deepStrictEqual(next.map((s) => s.amount), [100, 600], 'setting: bill-day purchases roll to the next bill');
}
{
  // 1 AM Manila on the 9th is still the 8th in UTC: the Manila date decides.
  const charges = [{ amount: 50, date: '2026-11-08T17:00:00.000Z', months: null }];
  assert.strictEqual(buildStatements({ ...base, charges, owed: 50 }).statements[0].billDate, day('2026-12-08'));
}
{
  const charges = [{ amount: 1000, date: at('2026-11-09'), months: 3 }];
  const { statements } = buildStatements({ ...base, charges, owed: 1000 });
  assert.deepStrictEqual(statements.map((s) => [s.billDate, s.amount]), [
    [day('2026-12-08'), 333.33], [day('2027-01-08'), 333.33], [day('2027-02-08'), 333.34],
  ], '3 months, last one takes the leftover centavo');
}
{
  // Owed ₱6,392.05 with nothing recorded: earlier balance over 2 months from the Nov bill.
  const { statements, earlierAmount } = buildStatements({
    ...base, charges: [], owed: 6392.05, earlier: { months: 2, firstBill: day('2026-11-08') },
  });
  assert.strictEqual(earlierAmount, 6392.05);
  assert.deepStrictEqual(statements.map((s) => [s.billDate, s.amount]), [
    [day('2026-11-08'), 3196.03], [day('2026-12-08'), 3196.02],
  ]);
  const unset = buildStatements({ ...base, charges: [], owed: 6392.05 }).statements;
  assert.deepStrictEqual(unset.map((s) => [s.billDate, s.amount]), [[day('2026-11-08'), 6392.05]],
    'months not set yet: all on the next bill');
}
{
  // ₱2,516.13 of charges already paid, ₱6,392.05 still owed beyond them.
  const charges = [{ amount: 2516.13, date: at('2026-10-20'), months: null }];
  const { statements, earlierAmount } = buildStatements({
    ...base, charges, payments: [{ amount: 2516.13 }], owed: 6392.05, earlier: { months: 2, firstBill: day('2026-11-08') },
  });
  assert.strictEqual(earlierAmount, 6392.05, 'earlier = owed − (charges − payments)');
  assert.deepStrictEqual(statements.map((s) => [s.amount, s.paid, s.remaining]), [
    [5712.16, 2516.13, 3196.03], [3196.02, 0, 3196.02],
  ], 'payment fills the oldest statement first');
}
{
  // Paying early counts toward the next bill; a transfer into the card counts as paid too.
  const charges = [{ amount: 900, date: at('2026-11-20'), months: 3 }];
  const early = buildStatements({ ...base, charges, payments: [{ amount: 400 }], owed: 500 }).statements;
  assert.deepStrictEqual(early.map((s) => s.remaining), [0, 200, 300]);
  const transferIn = buildStatements({ ...base, charges, payments: [], owed: 500 });
  assert.strictEqual(transferIn.earlierAmount, 0, 'negative gap is not an earlier balance');
  assert.deepStrictEqual(transferIn.statements.map((s) => s.remaining), [0, 200, 300], '…it pays the oldest bills');
}
{
  // Due day before bill day: billed 25 Nov, due 5 Dec.
  const card = { ...base, billDay: 25, dueDay: 5 };
  const s = buildStatements({ ...card, charges: [{ amount: 10, date: at('2026-11-20'), months: null }], owed: 10 }).statements[0];
  assert.deepStrictEqual([s.billDate, s.dueDate], [day('2026-11-25'), day('2026-12-05')]);
  // Bill day 31 clamps to the month's last day.
  const feb = buildStatements({ ...base, billDay: 31, dueDay: 10, charges: [{ amount: 10, date: at('2027-02-10'), months: null }], owed: 10 });
  assert.strictEqual(feb.statements[0].billDate, day('2027-02-28'));
}
{
  // Statuses, checked on 12 Nov: Oct bill overdue, Nov due soon, Dec upcoming; then paid.
  const charges = [
    { amount: 100, date: at('2026-09-20'), months: null },
    { amount: 200, date: at('2026-10-20'), months: null },
    { amount: 300, date: at('2026-11-20'), months: null },
  ];
  const today = at('2026-11-12');
  const { statements } = buildStatements({ ...base, today, charges, owed: 600 });
  assert.deepStrictEqual(statements.map((s) => s.status), ['overdue', 'dueSoon', 'upcoming']);
  assert.deepStrictEqual(summarize(statements, today), {
    dueNow: 300, overdue: 100, current: statements[1], next: statements[2], nextUnpaid: statements[0],
  });
  assert.strictEqual(creditStatus(summarize(statements, today)), 'overdue');
  const paid = buildStatements({ ...base, today, charges, payments: [{ amount: 300 }], owed: 300 }).statements;
  assert.deepStrictEqual(paid.map((s) => s.status), ['paid', 'paid', 'upcoming']);
  // Billed 25 Nov, due 15 Dec: on 26 Nov it's billed but not due within a week.
  const roomy = buildStatements({
    ...base, billDay: 25, dueDay: 15, today: at('2026-11-26'),
    charges: [{ amount: 10, date: at('2026-11-20'), months: null }], owed: 10,
  }).statements;
  assert.strictEqual(roomy[0].status, 'due');
}
{
  // Each bill lists what it's made of: which purchase, which installment, and any earlier balance.
  const charges = [
    { id: 'shoes', amount: 1000, date: at('2026-11-09'), months: 3 },
    { id: 'food', amount: 50, date: at('2026-11-20'), months: null },
  ];
  const { statements } = buildStatements({ ...base, charges, owed: 1150 });
  assert.deepStrictEqual(statements.map((s) => s.pieces), [
    [{ chargeId: null, index: 1, of: 1, amount: 100, paid: 0 }],
    [{ chargeId: 'shoes', index: 1, of: 3, amount: 333.33, paid: 0 }, { chargeId: 'food', index: 1, of: 1, amount: 50, paid: 0 }],
    [{ chargeId: 'shoes', index: 2, of: 3, amount: 333.33, paid: 0 }],
    [{ chargeId: 'shoes', index: 3, of: 3, amount: 333.34, paid: 0 }],
  ]);
  assert.deepStrictEqual(statements.map((s) => s.amount), [100, 383.33, 333.33, 333.34], 'bill = sum of its pieces');
}
{
  // What's left of the earlier balance goes down as it's paid; its original amount doesn't.
  const earlier = { months: 2, firstBill: day('2026-11-08') };
  const charges = [{ id: 'tv', amount: 1000, date: at('2026-11-07'), months: null }];
  const unpaid = buildStatements({ ...base, charges, owed: 2000, earlier });
  assert.deepStrictEqual([unpaid.earlierAmount, unpaid.earlierRemaining], [1000, 1000]);
  assert.deepStrictEqual(unpaid.statements[0].pieces.map((p) => p.chargeId), [null, 'tv'],
    'the earlier balance is the oldest debt on a bill, so it comes first');

  // ₱700 paid: the Nov bill (₱500 earlier + ₱1,000 tv) takes it, earlier piece first.
  const part = buildStatements({ ...base, charges, payments: [{ amount: 700 }], owed: 1300, earlier });
  assert.deepStrictEqual([part.earlierAmount, part.earlierRemaining], [1000, 500], 'original stays, remaining drops');
  assert.deepStrictEqual(part.statements[0].pieces.map((p) => p.paid), [500, 200]);

  const all = buildStatements({ ...base, charges, payments: [{ amount: 2000 }], owed: 0, earlier });
  assert.strictEqual(all.earlierRemaining, 0, 'paid in full');
}
{
  // 4 Nov: October's bill is paid, but purchases since 8 Oct sit on the 8 Nov bill (due 18 Nov), unpaid.
  // The status is that next unpaid bill, not "paid for October".
  const card = { ...base, dueDay: 18 };
  const charges = [
    { amount: 500, date: at('2026-09-20'), months: null },
    { amount: 800, date: at('2026-10-20'), months: null },
  ];
  const { statements } = buildStatements({ ...card, charges, payments: [{ amount: 500 }], owed: 800 });
  const s = summarize(statements, card.today);
  assert.strictEqual(s.current?.status, 'paid', 'October (latest billed) is paid…');
  assert.deepStrictEqual([s.nextUnpaid?.remaining, s.nextUnpaid?.dueDate], [800, day('2026-11-18')], '…but November is unpaid');
  assert.strictEqual(creditStatus(s), 'upcoming', 'so the line is not "paid"');
  const allPaid = buildStatements({ ...card, charges, payments: [{ amount: 1300 }], owed: 0 }).statements;
  assert.strictEqual(creditStatus(summarize(allPaid, card.today)), 'paid', 'paid only when nothing is owed');
}
{
  assert.deepStrictEqual(firstBillOptions(8, at('2026-11-04'), 3), [day('2026-11-08'), day('2026-12-08'), day('2027-01-08')]);
  assert.deepStrictEqual(firstBillOptions(8, at('2026-11-09'), 1), [day('2026-12-08')], 'after the bill day, next month');
}

console.log('creditStatements.ts: all checks passed');
