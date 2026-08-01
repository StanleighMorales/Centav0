# Custom Account Types

## Problem

`AccountType` is a fixed union of 5 values (`Cash | Bank | EWallet | CreditCard
| Other`), enforced by a `CHECK` constraint on the `accounts` table. Users
can't add their own account types (e.g. "Line of Credit", "Investment",
"BNPL").

## Goals

- Let users add, edit, and delete their own account types, in addition to
  the 5 built-in ones.
- Preserve the "Credit Card" overdraft/credit-line behavior (allowed to go
  negative, excluded from the accumulated-balance total) as an opt-in toggle
  any type — built-in or custom — can have.

## Non-goals

- No icon/color per type (the account list displays type as plain text
  today; adding decoration is unused surface area).
- No per-type behavior beyond the overdraft toggle.

## Data model

New table `account_types`, structurally identical to `categories`:

```sql
CREATE TABLE IF NOT EXISTS account_types (
  id              TEXT PRIMARY KEY NOT NULL,
  userId          TEXT NOT NULL,
  name            TEXT NOT NULL,
  allowsOverdraft INTEGER NOT NULL DEFAULT 0,
  createdAt       TEXT NOT NULL,
  updatedAt       TEXT NOT NULL,
  deletedAt       TEXT,
  isDirty         INTEGER NOT NULL DEFAULT 1,
  syncedAt        TEXT
);
```

```ts
export interface AccountType extends AuditFields, LocalSyncFields {
  id: string;
  userId: string;
  name: string;
  allowsOverdraft: boolean;
}
export interface CreateAccountTypeInput { name: string; allowsOverdraft?: boolean; }
export interface UpdateAccountTypeInput { name?: string; allowsOverdraft?: boolean; }
```

`accounts` table: `type TEXT CHECK (type IN (...))` is replaced by:

```sql
accountTypeId   TEXT NOT NULL REFERENCES account_types(id),
allowsOverdraft INTEGER NOT NULL DEFAULT 0,
```

`allowsOverdraft` is **denormalized** onto `accounts` — copied from the
chosen `account_types` row at create time and whenever the account's type is
changed. This is a deliberate tradeoff: roughly six call sites do raw SQL
like `SELECT currentBalance, type FROM accounts WHERE ...` and branch on
`type !== 'CreditCard'`. Denormalizing means those become
`allowsOverdraft = 0` with no JOIN, instead of rewriting every query.

`Account` domain type:

```ts
export interface Account extends AuditFields, LocalSyncFields {
  id: string;
  userId: string;
  name: string;
  accountTypeId: string;
  /** Denormalized from the account's type at write time. */
  allowsOverdraft: boolean;
  /** Joined from account_types for display. Read-only. */
  typeName: string;
  initialBalance: number;
  currentBalance: number;
  billDay: number | null;
  dueDay: number | null;
}

export interface CreateAccountInput {
  name: string; accountTypeId: string; initialBalance: number;
  billDay?: number; dueDay?: number;
}
export interface UpdateAccountInput {
  name?: string; accountTypeId?: string; billDay?: number; dueDay?: number;
}
```

The `AccountType` string union (`'Cash' | 'Bank' | ...`) is removed —
replaced by the new `AccountType` **interface** above (name collision is
intentional; nothing references the old union after migration).

`billDay`/`dueDay` — currently gated on `type === 'CreditCard'` in the Add
Account form — become gated on the selected type's `allowsOverdraft`.

## Migration

`010_account_types` (follows the `009_debt_type` / `006_installments_and_credit_cards` patterns):

1. Create `account_types`, seed 5 rows for `FIXED_USER_ID`:
   `Cash` (false), `Bank` (false), `E-Wallet` (false), `Credit Card` (true),
   `Other` (false).
2. Rebuild `accounts` (SQLite can't alter a `CHECK` constraint or add a
   `NOT NULL` FK column with data in place — same table-rebuild approach as
   migration 006): create `accounts_new` with `accountTypeId` +
   `allowsOverdraft` columns, copy every row mapping its old `type` string to
   the matching seeded `account_types.id`, drop `accounts`, rename
   `accounts_new` to `accounts`.

## Repository changes

- New `IAccountTypeRepository` / `SqliteAccountTypeRepository`:
  `list/getById/create/update/softDelete`, directly mirroring
  `ICategoryRepository`/`SqliteCategoryRepository`.
- `SqliteAccountRepository.rowToAccount` joins `account_types` (for
  `typeName`) and reads the denormalized `allowsOverdraft` column directly.
  `create`/`update` accept `accountTypeId`, look up the type's
  `allowsOverdraft`, and write both columns.
- Six call sites currently checking `.type !== 'CreditCard'` /
  `.type === 'CreditCard'` switch to `.allowsOverdraft` /
  `!.allowsOverdraft`:
  - `src/utils/accumulated.ts` (`spendableAccounts`)
  - `src/components/debts/AddPaymentSheet.tsx`
  - `src/components/transactions/TransferSheet.tsx`
  - `src/repositories/sqlite/SqliteDebtPaymentRepository.ts`
  - `src/repositories/sqlite/SqliteTransactionRepository.ts`
  - `src/repositories/sqlite/SqliteLendingRepository.ts`

## UI changes

**`app/account-types/index.tsx`** (new, mirrors `app/categories/index.tsx`)
- List of account types with an FAB to add.
- Tap to edit (name + "Allows overdraft" toggle).
- Delete blocked (same pattern as Categories: pre-check for accounts
  referencing the type, show a blocked-delete dialog) if any account uses
  it.

**`src/components/accounts/AccountTypeSheet.tsx`** (new, mirrors `CategorySheet.tsx`)
- Fields: Name (required), "Allows overdraft" toggle (`Switch`, same pattern
  as `AddDebtSheet`'s installment toggle).

**`src/components/accounts/AddAccountSheet.tsx`**
- Replaces the hardcoded `TYPE_OPTIONS` array with `accountTypeRepo.list()`
  loaded on open.
- `isCreditCard` becomes a lookup: `accountTypes.find(t => t.id === accountTypeId)?.allowsOverdraft`.
- Billing fields (`billDay`/`dueDay`) gated on that lookup instead of the
  literal string.

**`src/components/menu/MoreMenuSheet.tsx`**
- Add `<MenuItem icon="sliders" label="Account Types" onPress={() => go('/account-types')} />`
  under the "ACCOUNTS & CATEGORIES" section, next to Accounts/Categories.

## Open questions / risks

None outstanding — confirmed during brainstorming:
- Dedicated `account_types` table (not free-text), mirroring the existing
  Categories pattern.
- `allowsOverdraft` is a per-type toggle, not hardcoded to Credit Card.
- Management happens on its own screen, not inline in the account form's
  type picker.
