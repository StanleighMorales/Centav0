# Credit Limit for Credit Card Accounts

## Problem
Credit Card accounts have no spending cap, and the Credit tab's debt
detail page displays a linked debt like a plain one-time debt (amount +
due date), not conveying it's a revolving line with available credit.

## Data model
`Account.creditLimit: number | null` (nullable, overdraft accounts only).
Migration `012_credit_limit`: `ALTER TABLE accounts ADD COLUMN creditLimit REAL;`
`CreateAccountInput`/`UpdateAccountInput` gain `creditLimit?: number`.

## Enforcement (hard cap)
When `creditLimit` is set, block any spend that would push the account's
owed amount (`max(0, -currentBalance)`) past it. Applies at every site that
decreases an overdraft account's balance:
- `SqliteTransactionRepository.create` (Expense) — no balance check exists
  there today for any account type; this adds one only when a limit is set.
- `SqliteTransactionRepository.createTransfer` (source account)
- `SqliteTransactionRepository.update` (Expense edits)
- `SqliteDebtPaymentRepository.create` (paying another debt from this card)
- `SqliteLendingRepository.create` (lending out from this card)

Shared check via a small helper in `creditSync.ts`:
`assertWithinCreditLimit(account: {allowsOverdraft, currentBalance, creditLimit}, amount: number)`.

## UI
- `AddAccountSheet`: "Credit Limit" `AmountInput`, shown when the selected
  type `allowsOverdraft` (same gating as Bill/Due Day), optional.
- `app/debts/[id].tsx`: linked Credit debt with a `creditLimit` on its
  account shows "₱X owed of ₱Y limit" + "₱Z available" instead of the plain
  amount. No limit set → unchanged.
- `DebtRow` (Credit tab list): same "available" framing next to the amount
  for linked debts with a limit.
