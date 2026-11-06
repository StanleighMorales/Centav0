// Self-check for accounts.ts. No test framework in this repo — run it directly:
//   node --experimental-strip-types src/utils/accounts.check.mts
import assert from 'node:assert';
import { balanceAdjustment, balanceChanges, overdraws } from './accounts.ts';

assert.strictEqual(balanceAdjustment(100, 100), null, 'no change records nothing');
assert.deepStrictEqual(balanceAdjustment(100, 150.5), { type: 'Income', amount: 50.5 }, 'raising balance is Income');
assert.deepStrictEqual(balanceAdjustment(100, 40), { type: 'Expense', amount: 60 }, 'lowering balance is Expense');
assert.deepStrictEqual(balanceAdjustment(-20, 0), { type: 'Income', amount: 20 }, 'clearing an overdrawn balance is Income');
// Float noise must not leak a 0.000000001 adjustment.
assert.strictEqual(balanceAdjustment(0.1 + 0.2, 0.3), null, 'rounds to centavos before comparing');

// Editing a transaction: net change per account.
assert.deepStrictEqual([...balanceChanges(
  { accountId: 'gcash', type: 'Expense', amount: 100 }, { accountId: 'gcash', type: 'Expense', amount: 250 },
)], [['gcash', -150]], 'same account nets out');
assert.deepStrictEqual([...balanceChanges(
  { accountId: 'gcash', type: 'Expense', amount: 100 }, { accountId: 'cash', type: 'Expense', amount: 100 },
)], [['gcash', 100], ['cash', -100]], 'moving an expense refunds one account and charges the other');
assert.deepStrictEqual([...balanceChanges(
  { accountId: 'gcash', type: 'Income', amount: 500 }, { accountId: 'gcash', type: 'Income', amount: 200 },
)], [['gcash', -300]], 'shrinking an income takes money out');

assert.strictEqual(overdraws(100, -100), false, 'down to exactly zero is fine');
assert.strictEqual(overdraws(100, -100.01), true, 'one centavo below zero is not');
assert.strictEqual(overdraws(-17500, 5000), false, 'helping an already-negative account is fine');
assert.strictEqual(overdraws(-17500, -1), true, 'making it worse is not');
assert.strictEqual(overdraws(0.1 + 0.2, -0.3), false, 'rounds to centavos');

console.log('accounts.ts checks passed');
