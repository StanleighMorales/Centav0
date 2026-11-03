// Self-check for voiceTransaction.ts. No test framework in this repo — run it directly:
//   node --experimental-strip-types src/utils/voiceTransaction.check.mts
import assert from 'node:assert';
import { parseVoiceCommand, parseVoiceTransaction } from './voiceTransaction.ts';

const cats = [
  { id: 'food', name: 'Food', type: 'Expense' as const },
  { id: 'transport', name: 'Transport', type: 'Expense' as const },
  { id: 'other', name: 'Other', type: 'Expense' as const },
  { id: 'salary', name: 'Salary', type: 'Income' as const },
  { id: 'other-income', name: 'Other Income', type: 'Income' as const },
];

{
  const r = parseVoiceTransaction('add coffee worth 20 pesos as a expense', cats);
  assert.deepStrictEqual(r, { amount: 20, type: 'Expense', categoryId: 'food', accountId: null, note: 'Coffee' });
}
{
  assert.strictEqual(parseVoiceTransaction('orange juice 45', cats).categoryId, 'food', 'juice is food');
  assert.strictEqual(parseVoiceTransaction('bought bread for 60', cats).categoryId, 'food', 'bread is food');
}
{
  const accounts = [{ id: 'gcash', name: 'GCash' }, { id: 'bpi', name: 'BPI' }, { id: 'bpi-sav', name: 'BPI Savings' }];
  const r = parseVoiceTransaction('spent 150 on bread using my gcash', cats, undefined, accounts);
  assert.strictEqual(r.accountId, 'gcash', 'account named in speech');
  assert.strictEqual(r.note, 'Bread', 'account phrase dropped from note');
  assert.strictEqual(parseVoiceTransaction('paid 500 from bpi savings account', cats, undefined, accounts).accountId, 'bpi-sav', 'longest account name wins');
  assert.strictEqual(parseVoiceTransaction('lunch 200', cats, undefined, accounts).accountId, null, 'no account mentioned');
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

// parseVoiceCommand: transfers and debt payments.
const accs = [
  { id: 'cash', name: 'Cash', currentBalance: 3200 },
  { id: 'gcash', name: 'GCash', currentBalance: 900 },
  { id: 'mari', name: 'MariBank', currentBalance: -4500 },
];
const debts = [
  { id: 'atome', creditor: 'Atome', status: 'Open' as const },
  { id: 'mari-card', creditor: 'MariBank', status: 'Overdue' as const },
  { id: 'old', creditor: 'Home Credit', status: 'Paid' as const },
];
{
  assert.deepStrictEqual(parseVoiceCommand('transfer all cash to gcash', accs, debts),
    { kind: 'transfer', fromId: 'cash', toId: 'gcash', amount: 3200 }, 'all = source balance');
  assert.deepStrictEqual(parseVoiceCommand('transfer 500 from cash to my gcash', accs, debts),
    { kind: 'transfer', fromId: 'cash', toId: 'gcash', amount: 500 });
  assert.deepStrictEqual(parseVoiceCommand('move 1.5k to gcash', accs, debts),
    { kind: 'transfer', fromId: null, toId: 'gcash', amount: 1500 }, 'no source named');
  assert.deepStrictEqual(parseVoiceCommand('send everything to cash from gcash', accs, debts),
    { kind: 'transfer', fromId: 'gcash', toId: 'cash', amount: 900 }, 'order of to/from does not matter');
  assert.strictEqual((parseVoiceCommand('transfer all maribank to cash', accs, debts) as { amount: unknown }).amount, null,
    'nothing to move from an account that owes');
}
{
  assert.deepStrictEqual(parseVoiceCommand('pay my loan on atome with gcash', accs, debts),
    { kind: 'pay', debtId: 'atome', accountId: 'gcash', amount: null });
  assert.deepStrictEqual(parseVoiceCommand('pay 1,000 on atome using maribank', accs, debts),
    { kind: 'pay', debtId: 'atome', accountId: 'mari', amount: 1000 }, 'spoken amount');
  assert.deepStrictEqual(parseVoiceCommand('pay my maribank card with gcash', accs, debts),
    { kind: 'pay', debtId: 'mari-card', accountId: 'gcash', amount: null }, 'MariBank the card, not the account');
  assert.deepStrictEqual(parseVoiceCommand('pay my monthly balance with gcash', accs, debts),
    { kind: 'pay', debtId: null, accountId: 'gcash', amount: null }, 'no debt named → picker');
  assert.deepStrictEqual(parseVoiceCommand('pay my home credit loan', accs, debts),
    { kind: 'pay', debtId: null, accountId: null, amount: null }, 'paid-off debts are not matched');
}
{
  assert.deepStrictEqual(parseVoiceCommand('coffee 120', accs, debts), { kind: 'transaction' });
  assert.deepStrictEqual(parseVoiceCommand('pay 200 for parking', accs, debts), { kind: 'transaction' },
    'a plain "pay" with no debt or debt word is still an expense');
}

console.log('voiceTransaction.ts: all checks passed');
