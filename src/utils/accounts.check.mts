// Self-check for accounts.ts. No test framework in this repo — run it directly:
//   node --experimental-strip-types src/utils/accounts.check.mts
import assert from 'node:assert';
import { balanceAdjustment } from './accounts.ts';

assert.strictEqual(balanceAdjustment(100, 100), null, 'no change records nothing');
assert.deepStrictEqual(balanceAdjustment(100, 150.5), { type: 'Income', amount: 50.5 }, 'raising balance is Income');
assert.deepStrictEqual(balanceAdjustment(100, 40), { type: 'Expense', amount: 60 }, 'lowering balance is Expense');
assert.deepStrictEqual(balanceAdjustment(-20, 0), { type: 'Income', amount: 20 }, 'clearing an overdrawn balance is Income');
// Float noise must not leak a 0.000000001 adjustment.
assert.strictEqual(balanceAdjustment(0.1 + 0.2, 0.3), null, 'rounds to centavos before comparing');

console.log('accounts.ts checks passed');
