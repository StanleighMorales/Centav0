# Credit as a Separate Spendable Balance (revised model)

## Problem
The current Credit Card model starts an account's balance at 0 and drives
it negative as you spend, capped by `creditLimit`. The user wants credit to
behave like Cash/EWallet — a positive balance that decreases when spent —
just tracked separately from Total Balance.

## Data model
Reuses `accounts.creditLimit` (no new migration) — now means **Max
Balance**. `SqliteAccountRepository.create`: when the type `allowsOverdraft`,
`currentBalance` (and `initialBalance`) is set to `creditLimit` instead of
the form's balance input (which is hidden for these types).

## Enforcement flip
Every site that currently bypasses the overspend check for
`allowsOverdraft` accounts (`accumulated.ts`, `AddPaymentSheet.tsx`,
`TransferSheet.tsx`, `SqliteDebtPaymentRepository`,
`SqliteTransactionRepository`, `SqliteLendingRepository`) instead applies
the **same** `amount > currentBalance` check as normal accounts — a credit
card can't spend past its available balance. `assertWithinCreditLimit`
becomes redundant and is deleted; `syncLinkedCreditDebt` computes
`outstandingBalance = creditLimit - currentBalance` instead of
`max(0, -currentBalance)`. Paying the linked debt still credits the card
account, capped at `creditLimit` (can't restore past the max).

## Manual Credit debts stay independent
No change needed — `debtType='Credit'` with `linkedAccountId=null` (the
v0.0.5 manual-add path) is untouched by this rework; confirming it keeps
working during implementation.

## UI
- `AddAccountSheet`: "Initial Balance" hidden when `allowsOverdraft`;
  "Credit Limit" field relabeled **"Max Balance"**, required for those
  types.
- Dashboard: new "Total Credit" card next to "Total Balance" — sums all
  overdraft accounts' current balance, lists each account underneath.
- `app/debts/[id].tsx`: linked Credit debts get a category breakdown
  section (sum of non-deleted Expense transactions on the linked account,
  grouped by category).

## Known gap
Existing test Credit Card accounts created under the old (negative-balance)
model will look wrong after this ships — no conversion migration, since
this is pre-release test data. Delete and recreate any test cards.
