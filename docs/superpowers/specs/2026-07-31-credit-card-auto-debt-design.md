# Credit Card Auto-Debt Linking + Loan/Credit Transaction Visibility

## Problem

Credit Card (overdraft-capable) accounts today are just accounts — spending
on them lowers `currentBalance` below zero, but nothing surfaces "how much
is owed on this card" as a debt, nothing computes a due date from the
account's billing cycle, and that negative balance is currently lumped into
the dashboard's "Total Balance" alongside real spendable cash. Separately,
Loan disbursement (built in the debt-tabs feature) credits an account's
balance directly without creating a Transaction row, so it's invisible in
the Transactions tab and Recent list — the user wants loan and credit-card
money movement to show up there like any other transaction.

## Goals

- Every Credit Card (overdraft-capable) account automatically gets one
  linked Debt (`debtType='Credit'`) that tracks what's owed on it, separate
  from any Credit debts the user adds manually.
- The linked debt's owed amount and due date update in real time as the
  card is spent from, transferred from, or used to pay off other debts/
  lendings — no batch/statement job.
- Paying down a linked Credit debt frees up the card's available credit
  (credits the card account back toward zero).
- Loan disbursement and Credit Card spending both show up in the
  Transactions tab and dashboard Recent list.
- Dashboard "Total Balance" no longer includes overdraft-capable accounts.

## Non-goals

- No monthly statement/billing-cycle batch job — everything syncs
  immediately on each write, consistent with this being an offline SQLite
  app with no background scheduler.
- No change to how manual (unlinked) Credit/Loan/Custom debts work — they
  keep the exact v0.0.5 behavior.

## Data model

```ts
export interface Debt extends AuditFields, LocalSyncFields {
  // ...existing fields...
  /** Set only for auto-managed Credit debts mirroring a Credit Card account's balance. */
  linkedAccountId: string | null;
}
```

No reverse pointer on `Account` — the linked debt is found via
`SELECT * FROM debts WHERE linkedAccountId = ? AND deletedAt IS NULL`,
avoiding two fields that could drift out of sync.

## Migration

`011_credit_card_linked_debt`:

```sql
ALTER TABLE debts ADD COLUMN linkedAccountId TEXT;
```

Then, in JS: for every existing account with `allowsOverdraft = 1`, insert a
linked Debt row (`creditor = account.name`, `debtType = 'Credit'`,
`originalAmount = outstandingBalance = max(0, -account.currentBalance)`,
`dueDate` computed from the account's `dueDay` if set, `linkedAccountId =
account.id`). This backfills Credit Card accounts created before this
feature (including ones created while testing v0.0.5/custom account types).

## Creating a Credit Card account

`SqliteAccountRepository.create`: after inserting the account, if the
chosen type's `allowsOverdraft` is true, also insert a linked Debt in the
same transaction (starting at 0 owed, `dueDate` from `dueDay` if provided).

## Real-time sync

New helper in `src/repositories/sqlite/creditSync.ts`:

```ts
export async function syncLinkedCreditDebt(db: SQLiteDatabase, accountId: string): Promise<void>
```

Looks up the account's linked debt (no-op if none). Sets
`outstandingBalance = originalAmount = max(0, -account.currentBalance)`,
recomputes `dueDate` to the next occurrence of the account's `dueDay` from
today (helper `nextDueDate(dueDay, fromDate)` in `src/utils/date.ts`), and
recomputes `status` via the existing `computeStatus` logic.

Called at the end of every `db.withTransactionAsync` block that changes
`accounts.currentBalance` for an account that might be linked:

- `SqliteTransactionRepository.create`, `.update`, `.createTransfer`, `.softDelete`
- `SqliteDebtPaymentRepository.create`, `.softDelete`
- `SqliteLendingRepository.create` and its payment/softDelete paths
- `SqliteDebtRepository.create`/`.softDelete` (Loan disbursement path, below)

Credit Card spending already goes through the normal Expense-transaction
path in `AddTransactionSheet` today — no UI change needed there, it just
starts triggering sync.

## Repayment restores available credit

`SqliteDebtPaymentRepository.create`, when the debt being paid has a
`linkedAccountId`, additionally credits that card account's `currentBalance`
by the payment amount (on top of debiting the paying account as it does
today), then calls `syncLinkedCreditDebt` for the card account. This is what
makes "pay down the linked debt" and "card balance moves back toward zero"
the same operation — `syncLinkedCreditDebt` re-derives `outstandingBalance`
from the now-less-negative `currentBalance`.

## Loan disbursement becomes a real transaction

`SqliteDebtRepository.create` (Loan path): replaces the direct
`UPDATE accounts SET currentBalance = currentBalance + ?` with an inserted
`Transaction` row (`type = 'Income'`, `accountId = input.accountId`,
`amount = originalAmount`, `note = 'Loan from {creditor}'`). Category is
resolved via get-or-create: look up an Income category named "Loan" for the
user; insert one if missing (avoids a fragile migration-seeded row the user
could delete before ever taking a loan).

`SqliteDebtRepository.softDelete` (reversal path): instead of a bare balance
UPDATE, soft-deletes the linked Transaction row directly (marks
`deletedAt`, reverses the account credit — the same two statements
`SqliteTransactionRepository.softDelete` already runs for an Income
transaction, inlined here since repositories don't call each other in this
codebase) so Transactions/Recent stay consistent after undoing a loan.

## UI changes

**`app/debts/[id].tsx` / swipe-edit in `app/(tabs)/debts.tsx`**
- Debts with `linkedAccountId` set hide the Edit and Delete actions (amount
  and due date are derived, not hand-editable) but keep "Add Payment".
  Deleting a linked debt happens implicitly when its Credit Card account is
  deleted (cascade soft-delete of the linked debt alongside the account).

**`app/(tabs)/index.tsx` (dashboard)**
- "Total Balance" switches from summing all accounts to
  `spendableAccounts(accounts)` sum, excluding overdraft-capable accounts —
  consistent with how `debts.tsx`/`lent.tsx` already compute "available
  funds".

## Open questions / risks

None outstanding — confirmed during brainstorming:
- One persistent linked Debt per Credit Card account (not a virtual/computed
  row).
- Real-time sync on every balance-affecting write, not a billing-cycle
  batch.
- Due date always recalculated to the next upcoming Due Day.
- Paying the linked debt restores card credit.
- Loan disbursement recorded as a real Income transaction.
