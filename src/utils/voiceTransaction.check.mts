// Self-check for voiceTransaction.ts. No test framework in this repo — run it directly:
//   node --experimental-strip-types src/utils/voiceTransaction.check.mts
import assert from 'node:assert';
import { parseVoiceTransaction } from './voiceTransaction.ts';

const cats = [
  { id: 'food', name: 'Food', type: 'Expense' as const },
  { id: 'transport', name: 'Transport', type: 'Expense' as const },
  { id: 'other', name: 'Other', type: 'Expense' as const },
  { id: 'salary', name: 'Salary', type: 'Income' as const },
  { id: 'other-income', name: 'Other Income', type: 'Income' as const },
];

{
  const r = parseVoiceTransaction('add coffee worth 20 pesos as a expense', cats);
  assert.deepStrictEqual(r, { amount: 20, type: 'Expense', categoryId: 'food', note: 'Coffee' });
}
{
  const r = parseVoiceTransaction('spent 1,250.50 on grab', cats);
  assert.strictEqual(r.amount, 1250.5, 'commas and decimals');
  assert.strictEqual(r.categoryId, 'transport', 'keyword hint');
  assert.strictEqual(r.note, 'Grab');
}
{
  const r = parseVoiceTransaction('received salary 25k', cats);
  assert.strictEqual(r.amount, 25000, 'k suffix');
  assert.strictEqual(r.type, 'Income');
  assert.strictEqual(r.categoryId, 'salary');
}
{
  const r = parseVoiceTransaction('other income 500 from tita', cats);
  assert.strictEqual(r.categoryId, 'other-income', 'longest category name wins');
}
{
  const r = parseVoiceTransaction('lunch with friends ₱350', cats);
  assert.strictEqual(r.amount, 350, 'peso sign');
  assert.strictEqual(r.categoryId, 'food');
  assert.strictEqual(r.note, 'Lunch with friends');
}
{
  const r = parseVoiceTransaction('new shoes', cats);
  assert.strictEqual(r.amount, null, 'no number heard');
  assert.strictEqual(r.categoryId, null, 'no matching category');
}
{
  const r = parseVoiceTransaction('salary 100', cats, 'Expense');
  assert.strictEqual(r.type, 'Expense', 'forced type wins');
  assert.strictEqual(r.categoryId, null, 'only matches categories of the forced type');
}

console.log('voiceTransaction.ts: all checks passed');
