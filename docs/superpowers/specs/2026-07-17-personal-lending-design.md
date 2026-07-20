# Personal Lending Tracker + Header Overflow Menu

## Problem

1. The "More" bottom tab (Accounts, Categories, Budgets, Reports, Help) takes up a whole nav slot for a page that's just a settings-style menu.
2. There's no way to track money the user lends out to family/friends (amount, who, when, whether it's been paid back).

## Goals

- Free up the bottom nav slot currently occupied by "More" for a new "Lent" feature.
- Move the More menu to a 3-dot icon in the top-right header, available from every tab screen.
- Let the user record money lent to a person, from a specific account (debited immediately), track partial paybacks (credited to a chosen account on repayment), and see a running per-person total.

## Non-goals

- Due dates / overdue tracking for lendings (parity with Debts was considered and explicitly rejected — just `Active` / `Paid`).
- Multi-user/sync semantics beyond the existing `isDirty`/`syncedAt` scaffolding already used by every other table.

## Data model

New migration `008_lending` in `src/db/migrations.ts`, new tables in `src/db/schema.ts`:

```sql
CREATE TABLE lending_people (
  id          TEXT PRIMARY KEY NOT NULL,
  userId      TEXT NOT NULL,
  name        TEXT NOT NULL,
  createdAt   TEXT NOT NULL,
  updatedAt   TEXT NOT NULL,
  deletedAt   TEXT,
  isDirty     INTEGER NOT NULL DEFAULT 1,
  syncedAt    TEXT
);

CREATE TABLE lendings (
  id                  TEXT PRIMARY KEY NOT NULL,
  userId              TEXT NOT NULL,
  personId            TEXT NOT NULL,
  amount              REAL NOT NULL,
  outstandingBalance  REAL NOT NULL,
  accountId           TEXT NOT NULL,
  date                TEXT NOT NULL,
  note                TEXT,
  status              TEXT NOT NULL CHECK (status IN ('Active','Paid')),
  createdAt           TEXT NOT NULL,
  updatedAt           TEXT NOT NULL,
  deletedAt           TEXT,
  isDirty             INTEGER NOT NULL DEFAULT 1,
  syncedAt            TEXT,
  FOREIGN KEY (personId)  REFERENCES lending_people(id),
  FOREIGN KEY (accountId) REFERENCES accounts(id)
);
CREATE INDEX idx_lending_person ON lendings(personId);

CREATE TABLE lending_payments (
  id           TEXT PRIMARY KEY NOT NULL,
  userId       TEXT NOT NULL,
  lendingId    TEXT NOT NULL,
  date         TEXT NOT NULL,
  amount       REAL NOT NULL,
  accountId    TEXT NOT NULL,
  createdAt    TEXT NOT NULL,
  updatedAt    TEXT NOT NULL,
  deletedAt    TEXT,
  isDirty      INTEGER NOT NULL DEFAULT 1,
  syncedAt     TEXT,
  FOREIGN KEY (lendingId) REFERENCES lendings(id),
  FOREIGN KEY (accountId) REFERENCES accounts(id)
);
CREATE INDEX idx_lp_lending ON lending_payments(lendingId);
CREATE INDEX idx_lp_date    ON lending_payments(date);
```

Domain types added to `src/domain/types.ts`: `LendingPerson`, `Lending`, `LendingStatus`, `LendingPayment`, plus `Create*`/`Update*` input types, mirroring `Debt`/`DebtPayment`.

### Balance semantics (mirrors debts, inverted)

- **Debts**: creating a debt does *not* touch account balances (the borrowed cash already showed up elsewhere); paying it down debits an account.
- **Lendings**: the inverse. Creating a lending *debits* the source account immediately (cash leaves the wallet to hand to the person); recording a payback *credits* the destination account and reduces `outstandingBalance`, flipping `status` to `Paid` at zero. Soft-deleting a lending or a payment reverses the corresponding account balance changes, exactly like `SqliteDebtRepository`/`SqliteDebtPaymentRepository` do today.

## Repositories

New files under `src/repositories/`, following the existing `IDebtRepository`/`SqliteDebtRepository` split:

- `ILendingPersonRepository` / `SqliteLendingPersonRepository`: `list`, `create`, `update` (rename), `softDelete`.
- `ILendingRepository` / `SqliteLendingRepository`: `list`, `getById`, `create` (debits source account in the same transaction), `update`, `markPaid`, `softDelete` (reverses the original debit).
- `ILendingPaymentRepository` / `SqliteLendingPaymentRepository`: `list`, `listByLending`, `getById`, `create` (credits destination account, reduces outstanding, in one transaction), `softDelete` (reverses both).

Registered in `src/repositories/index.ts` alongside the existing exports.

## Screens & components

- `app/(tabs)/lent.tsx` — replaces `more.tsx` in the tab bar. Structure mirrors `debts.tsx`: `Active`/`Paid` tab row, summary card (Total lent out, Cash + E-wallets available, Paid back this month), `FlatList` of lending rows (swipe-to-edit), `FAB` to add. Each row shows person name, date, note snippet, and outstanding amount (or "PAID" + total paid, like `DebtRow`).
- A person filter chip row above the list (all people + "All") to see one person's running total — satisfies "how much did Mom borrow" without a separate screen.
- `app/lent/[id].tsx` — lending detail: person, original amount, outstanding balance, payment history list, "Add Payment" (destination account picker) and "Mark Paid" actions — mirrors the existing debt detail screen.
- `src/components/lending/AddLendingSheet.tsx` — person picker (existing `lending_people` + inline "add new person" text input that creates one on submit), amount, source account picker, date, note. Mirrors `AddDebtSheet.tsx`.
- `src/components/lending/AddLendingPaymentSheet.tsx` (or inline in the detail screen, whichever the existing debt-payment UI does) — amount + destination account.

## Header overflow menu

- Extract the current `more.tsx` body (menu items only, no screen chrome) into `src/components/menu/MoreMenuSheet.tsx`, presented as a modal/bottom sheet.
- Add a small shared header row component (or inline addition to each screen's existing title row) with a `Feather name="more-vertical"` icon button, top-right, opening `MoreMenuSheet`. Applied to `index.tsx`, `transactions.tsx`, `debts.tsx`, `lent.tsx`.
- Delete `app/(tabs)/more.tsx` and its tab entry.

## Bottom nav

- `app/(tabs)/_layout.tsx`: replace the `more` `Tabs.Screen` with `lent`, title "Lent", icon `Feather name="users"`.

## Testing

- One assert-style check per money-moving path (mirroring how debt payments are already trusted via manual QA, no existing automated tests for repositories in this codebase): manually verify in the running app that creating a lending debits the chosen account, a payment credits the chosen account and reduces outstanding to zero at full payback, and soft-deleting each reverses the balance.
