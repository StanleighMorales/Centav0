# Personal Lending Tracker + Header Overflow Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "More" bottom tab with a "Lent" tab for tracking personal lending (money lent to people, tracked per-person, debited/credited against real accounts), and move the old More menu into a 3-dot header icon on every tab screen.

**Architecture:** Mirrors the existing Debts feature exactly, inverted: `lendings` (like `debts`) + `lending_payments` (like `debt_payments`), plus a new `lending_people` reference table (like `categories`) for reusable borrower names. Creating a lending debits an account immediately; recording a payback credits an account — the reverse of how debt creation/payment touch balances. Same repository interface/SQLite-impl split, same screen/sheet component shapes as `debts.tsx`/`AddDebtSheet`/`AddPaymentSheet`/`app/debts/[id].tsx`.

**Tech Stack:** Expo SDK 54, expo-router, expo-sqlite, React Native, TypeScript. No test framework is configured in this repo (confirmed via glob — no `*.test.ts` or `jest.config` outside `node_modules`), so verification steps below are manual app checks, consistent with how every other repository (`debtRepo`, `debtPaymentRepo`, etc.) is currently verified.

**Reference spec:** `docs/superpowers/specs/2026-07-17-personal-lending-design.md`

---

## Task 1: Domain types

**Files:**
- Modify: `src/domain/types.ts`

- [ ] **Step 1: Append lending types to the end of the file**

```typescript
export type LendingStatus = 'Active' | 'Paid';

export interface LendingPerson extends AuditFields, LocalSyncFields {
  id: string;
  userId: string;
  name: string;
}
export interface CreateLendingPersonInput { name: string; }
export interface UpdateLendingPersonInput { name?: string; }

export interface Lending extends AuditFields, LocalSyncFields {
  id: string;
  userId: string;
  personId: string;
  amount: number;
  outstandingBalance: number;
  accountId: string;
  date: string;
  note: string | null;
  status: LendingStatus;
}
export interface CreateLendingInput {
  personId: string; amount: number; accountId: string; date: string; note?: string;
}
export interface UpdateLendingInput { note?: string; }

export interface LendingPayment extends AuditFields, LocalSyncFields {
  id: string; userId: string; lendingId: string;
  date: string; amount: number; accountId: string;
}
export interface CreateLendingPaymentInput { date: string; amount: number; accountId: string; }
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `types.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat: add lending domain types"
```

---

## Task 2: Database migration

**Files:**
- Modify: `src/db/migrations.ts`

- [ ] **Step 1: Add migration `008_lending` before the closing `];` of `MIGRATIONS`**

Insert after the `007_transfers` entry (before the final `];`):

```typescript
  {
    name: '008_lending',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS lending_people (
          id          TEXT PRIMARY KEY NOT NULL,
          userId      TEXT NOT NULL,
          name        TEXT NOT NULL,
          createdAt   TEXT NOT NULL,
          updatedAt   TEXT NOT NULL,
          deletedAt   TEXT,
          isDirty     INTEGER NOT NULL DEFAULT 1,
          syncedAt    TEXT
        );

        CREATE TABLE IF NOT EXISTS lendings (
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
        CREATE INDEX IF NOT EXISTS idx_lending_person ON lendings(personId);

        CREATE TABLE IF NOT EXISTS lending_payments (
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
        CREATE INDEX IF NOT EXISTS idx_lp_lending ON lending_payments(lendingId);
        CREATE INDEX IF NOT EXISTS idx_lp_date    ON lending_payments(date);
      `);
    },
  },
```

- [ ] **Step 2: Verify the app boots and the migration applies**

Run: `npx expo start` (or however the project is normally run), open the app in Expo Go. Confirm no red-screen errors on boot. If a SQLite debugger/inspector is available, confirm `lending_people`, `lendings`, `lending_payments` tables exist; otherwise proceed — Task 3's manual check will confirm indirectly (insert would fail with "no such table" if this step were wrong).

- [ ] **Step 3: Commit**

```bash
git add src/db/migrations.ts
git commit -m "feat: add lending tables migration"
```

---

## Task 3: Lending person repository

**Files:**
- Create: `src/repositories/ILendingPersonRepository.ts`
- Create: `src/repositories/sqlite/SqliteLendingPersonRepository.ts`
- Modify: `src/repositories/index.ts`

- [ ] **Step 1: Create the interface**

`src/repositories/ILendingPersonRepository.ts`:

```typescript
import type { LendingPerson, CreateLendingPersonInput, UpdateLendingPersonInput } from '../domain/types';

export interface ILendingPersonRepository {
  list(): Promise<LendingPerson[]>;
  getById(id: string): Promise<LendingPerson | null>;
  create(input: CreateLendingPersonInput): Promise<LendingPerson>;
  update(id: string, input: UpdateLendingPersonInput): Promise<LendingPerson>;
  softDelete(id: string): Promise<void>;
}
```

- [ ] **Step 2: Create the SQLite implementation**

`src/repositories/sqlite/SqliteLendingPersonRepository.ts`:

```typescript
import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { FIXED_USER_ID } from '../../constants/user';
import type { ILendingPersonRepository } from '../ILendingPersonRepository';
import type { LendingPerson, CreateLendingPersonInput, UpdateLendingPersonInput } from '../../domain/types';

function rowToPerson(row: any): LendingPerson {
  return {
    id: row.id, userId: row.userId, name: row.name,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}

export class SqliteLendingPersonRepository implements ILendingPersonRepository {
  async list(): Promise<LendingPerson[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM lending_people WHERE userId = ? AND deletedAt IS NULL ORDER BY name ASC`,
      [FIXED_USER_ID],
    );
    return rows.map(rowToPerson);
  }

  async getById(id: string): Promise<LendingPerson | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM lending_people WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [id, FIXED_USER_ID],
    );
    return row ? rowToPerson(row) : null;
  }

  async create(input: CreateLendingPersonInput): Promise<LendingPerson> {
    const db = await getDatabase();
    const id = newId();
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO lending_people (id, userId, name, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
       VALUES (?, ?, ?, ?, ?, NULL, 1, NULL)`,
      [id, FIXED_USER_ID, input.name, now, now],
    );
    const created = await this.getById(id);
    if (!created) throw new Error('LendingPerson creation failed silently');
    return created;
  }

  async update(id: string, input: UpdateLendingPersonInput): Promise<LendingPerson> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`LendingPerson ${id} not found`);
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE lending_people SET name = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [input.name ?? existing.name, now, id, FIXED_USER_ID],
    );
    const updated = await this.getById(id);
    if (!updated) throw new Error('LendingPerson vanished after update');
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE lending_people SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [now, now, id, FIXED_USER_ID],
    );
  }
}
```

- [ ] **Step 3: Register in the repository index**

Modify `src/repositories/index.ts`. Add these import lines alongside the existing debt ones:

```typescript
import { SqliteLendingPersonRepository } from './sqlite/SqliteLendingPersonRepository';
import type { ILendingPersonRepository } from './ILendingPersonRepository';
```

Add this export alongside `debtRepo`:

```typescript
export const lendingPersonRepo: ILendingPersonRepository = new SqliteLendingPersonRepository();
```

Add `ILendingPersonRepository` to the `export type { ... }` line at the bottom.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/ILendingPersonRepository.ts src/repositories/sqlite/SqliteLendingPersonRepository.ts src/repositories/index.ts
git commit -m "feat: add lending person repository"
```

---

## Task 4: Lending repository (create debits source account)

**Files:**
- Create: `src/repositories/ILendingRepository.ts`
- Create: `src/repositories/sqlite/SqliteLendingRepository.ts`
- Modify: `src/repositories/index.ts`

- [ ] **Step 1: Create the interface**

`src/repositories/ILendingRepository.ts`:

```typescript
import type { Lending, CreateLendingInput, UpdateLendingInput } from '../domain/types';

export interface ILendingRepository {
  list(): Promise<Lending[]>;
  getById(id: string): Promise<Lending | null>;
  create(input: CreateLendingInput): Promise<Lending>;
  update(id: string, input: UpdateLendingInput): Promise<Lending>;
  markPaid(id: string): Promise<Lending>;
  softDelete(id: string): Promise<void>;
}
```

- [ ] **Step 2: Create the SQLite implementation**

`src/repositories/sqlite/SqliteLendingRepository.ts`:

```typescript
import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { roundCentavos } from '../../utils/currency';
import { FIXED_USER_ID } from '../../constants/user';
import type { ILendingRepository } from '../ILendingRepository';
import type { Lending, CreateLendingInput, UpdateLendingInput } from '../../domain/types';

function rowToLending(row: any): Lending {
  return {
    id: row.id, userId: row.userId, personId: row.personId,
    amount: row.amount, outstandingBalance: row.outstandingBalance,
    accountId: row.accountId, date: row.date, note: row.note ?? null,
    status: row.status,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}

export class SqliteLendingRepository implements ILendingRepository {
  async list(): Promise<Lending[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM lendings WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAt DESC`,
      [FIXED_USER_ID],
    );
    return rows.map(rowToLending);
  }

  async getById(id: string): Promise<Lending | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM lendings WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [id, FIXED_USER_ID],
    );
    return row ? rowToLending(row) : null;
  }

  async create(input: CreateLendingInput): Promise<Lending> {
    const db = await getDatabase();
    const id = newId();
    const now = nowIso();
    const amount = roundCentavos(input.amount);
    const account = await db.getFirstAsync<any>(
      `SELECT currentBalance, type FROM accounts WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [input.accountId, FIXED_USER_ID],
    );
    if (!account) throw new Error(`Account ${input.accountId} not found`);
    if (account.type !== 'CreditCard' && amount > roundCentavos(account.currentBalance)) {
      throw new Error('Lending amount is more than this account has');
    }
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO lendings (id, userId, personId, amount, outstandingBalance, accountId, date, note, status, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, NULL, 1, NULL)`,
        [id, FIXED_USER_ID, input.personId, amount, amount, input.accountId, input.date, input.note ?? null, now, now],
      );
      await db.runAsync(
        `UPDATE accounts SET currentBalance = currentBalance - ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [amount, now, input.accountId, FIXED_USER_ID],
      );
    });
    const created = await this.getById(id);
    if (!created) throw new Error('Lending creation failed silently');
    return created;
  }

  async update(id: string, input: UpdateLendingInput): Promise<Lending> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Lending ${id} not found`);
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE lendings SET note = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      ['note' in input ? (input.note ?? null) : existing.note, now, id, FIXED_USER_ID],
    );
    const updated = await this.getById(id);
    if (!updated) throw new Error('Lending vanished after update');
    return updated;
  }

  async markPaid(id: string): Promise<Lending> {
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE lendings SET outstandingBalance = 0, status = 'Paid', updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [now, id, FIXED_USER_ID],
    );
    const updated = await this.getById(id);
    if (!updated) throw new Error('Lending vanished after markPaid');
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const lending = await this.getById(id);
    if (!lending) return;
    const db = await getDatabase();
    const now = nowIso();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE lendings SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [now, now, id, FIXED_USER_ID],
      );
      // Reverse the original debit — give the money back to the source account.
      await db.runAsync(
        `UPDATE accounts SET currentBalance = currentBalance + ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [lending.amount, now, lending.accountId, FIXED_USER_ID],
      );
    });
  }
}
```

- [ ] **Step 3: Register in the repository index**

Modify `src/repositories/index.ts`. Add imports:

```typescript
import { SqliteLendingRepository } from './sqlite/SqliteLendingRepository';
import type { ILendingRepository } from './ILendingRepository';
```

Add export:

```typescript
export const lendingRepo: ILendingRepository = new SqliteLendingRepository();
```

Add `ILendingRepository` to the `export type { ... }` line.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/ILendingRepository.ts src/repositories/sqlite/SqliteLendingRepository.ts src/repositories/index.ts
git commit -m "feat: add lending repository with account debit on create"
```

---

## Task 5: Lending payment repository (payback credits destination account)

**Files:**
- Create: `src/repositories/ILendingPaymentRepository.ts`
- Create: `src/repositories/sqlite/SqliteLendingPaymentRepository.ts`
- Modify: `src/repositories/index.ts`

- [ ] **Step 1: Create the interface**

`src/repositories/ILendingPaymentRepository.ts`:

```typescript
import type { LendingPayment, CreateLendingPaymentInput } from '../domain/types';

export interface ILendingPaymentRepository {
  list(): Promise<LendingPayment[]>;
  listByLending(lendingId: string): Promise<LendingPayment[]>;
  getById(id: string): Promise<LendingPayment | null>;
  create(lendingId: string, input: CreateLendingPaymentInput): Promise<LendingPayment>;
  softDelete(id: string): Promise<void>;
}
```

- [ ] **Step 2: Create the SQLite implementation**

`src/repositories/sqlite/SqliteLendingPaymentRepository.ts`:

```typescript
import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { roundCentavos } from '../../utils/currency';
import { FIXED_USER_ID } from '../../constants/user';
import type { ILendingPaymentRepository } from '../ILendingPaymentRepository';
import type { LendingPayment, CreateLendingPaymentInput } from '../../domain/types';

function rowToPayment(row: any): LendingPayment {
  return {
    id: row.id, userId: row.userId, lendingId: row.lendingId,
    date: row.date, amount: row.amount, accountId: row.accountId,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}

export class SqliteLendingPaymentRepository implements ILendingPaymentRepository {
  async list(): Promise<LendingPayment[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM lending_payments WHERE userId = ? AND deletedAt IS NULL ORDER BY date DESC`,
      [FIXED_USER_ID],
    );
    return rows.map(rowToPayment);
  }

  async listByLending(lendingId: string): Promise<LendingPayment[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM lending_payments WHERE lendingId = ? AND userId = ? AND deletedAt IS NULL ORDER BY date DESC`,
      [lendingId, FIXED_USER_ID],
    );
    return rows.map(rowToPayment);
  }

  async getById(id: string): Promise<LendingPayment | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM lending_payments WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [id, FIXED_USER_ID],
    );
    return row ? rowToPayment(row) : null;
  }

  async create(lendingId: string, input: CreateLendingPaymentInput): Promise<LendingPayment> {
    const db = await getDatabase();
    const id = newId();
    const now = nowIso();
    const amount = roundCentavos(input.amount);
    const lending = await db.getFirstAsync<any>(
      `SELECT outstandingBalance FROM lendings WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [lendingId, FIXED_USER_ID],
    );
    if (!lending) throw new Error(`Lending ${lendingId} not found`);
    if (amount > roundCentavos(lending.outstandingBalance)) throw new Error('Payment exceeds remaining amount owed');
    const account = await db.getFirstAsync<any>(
      `SELECT id FROM accounts WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [input.accountId, FIXED_USER_ID],
    );
    if (!account) throw new Error(`Account ${input.accountId} not found`);
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO lending_payments (id, userId, lendingId, date, amount, accountId, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
        [id, FIXED_USER_ID, lendingId, input.date, amount, input.accountId, now, now],
      );
      await db.runAsync(
        `UPDATE lendings SET
           outstandingBalance = MAX(0, outstandingBalance - ?),
           status = CASE WHEN (outstandingBalance - ?) <= 0 THEN 'Paid' ELSE status END,
           updatedAt = ?, isDirty = 1
         WHERE id = ? AND userId = ?`,
        [amount, amount, now, lendingId, FIXED_USER_ID],
      );
      // Payback credits the destination account.
      await db.runAsync(
        `UPDATE accounts SET currentBalance = currentBalance + ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [amount, now, input.accountId, FIXED_USER_ID],
      );
    });
    const created = await this.getById(id);
    if (!created) throw new Error('LendingPayment creation failed silently');
    return created;
  }

  async softDelete(id: string): Promise<void> {
    const payment = await this.getById(id);
    if (!payment) return;
    const db = await getDatabase();
    const now = nowIso();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE lending_payments SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [now, now, id, FIXED_USER_ID],
      );
      await db.runAsync(
        `UPDATE lendings SET
           outstandingBalance = outstandingBalance + ?,
           status = CASE WHEN status = 'Paid' THEN 'Active' ELSE status END,
           updatedAt = ?, isDirty = 1
         WHERE id = ? AND userId = ?`,
        [payment.amount, now, payment.lendingId, FIXED_USER_ID],
      );
      // Reverse the credit.
      await db.runAsync(
        `UPDATE accounts SET currentBalance = currentBalance - ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
        [payment.amount, now, payment.accountId, FIXED_USER_ID],
      );
    });
  }
}
```

- [ ] **Step 3: Register in the repository index**

Modify `src/repositories/index.ts`. Add imports:

```typescript
import { SqliteLendingPaymentRepository } from './sqlite/SqliteLendingPaymentRepository';
import type { ILendingPaymentRepository } from './ILendingPaymentRepository';
```

Add export:

```typescript
export const lendingPaymentRepo: ILendingPaymentRepository = new SqliteLendingPaymentRepository();
```

Add `ILendingPaymentRepository` to the `export type { ... }` line.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/ILendingPaymentRepository.ts src/repositories/sqlite/SqliteLendingPaymentRepository.ts src/repositories/index.ts
git commit -m "feat: add lending payment repository with account credit on payback"
```

---

## Task 6: Shared screen header + extracted More menu

**Files:**
- Create: `src/components/ui/ScreenHeader.tsx`
- Create: `src/components/menu/MoreMenuSheet.tsx`

- [ ] **Step 1: Create `ScreenHeader`**

`src/components/ui/ScreenHeader.tsx`:

```typescript
import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from './AppText';
import { MoreMenuSheet } from '../menu/MoreMenuSheet';
import { theme } from '../../theme';

type Props = { title: string };

export function ScreenHeader({ title }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.row}>
      <AppText variant="h2">{title}</AppText>
      <Pressable
        onPress={() => setMenuOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="More options"
        style={styles.menuBtn}
      >
        <Feather name="more-vertical" size={22} color={theme.colors.textPrimary} />
      </Pressable>
      <MoreMenuSheet visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -theme.spacing[2],
  },
});
```

- [ ] **Step 2: Create `MoreMenuSheet`**, moving the menu items out of `app/(tabs)/more.tsx` as-is

`src/components/menu/MoreMenuSheet.tsx`:

```typescript
import React from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BottomSheet } from '../ui/BottomSheet';
import { AppText } from '../ui/AppText';
import { theme } from '../../theme';

type MenuItemProps = {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
};

function MenuItem({ icon, label, onPress }: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Feather name={icon} size={20} color={theme.colors.textSecondary} />
      <AppText variant="body" style={styles.rowLabel}>{label}</AppText>
      <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

type Props = { visible: boolean; onClose: () => void };

export function MoreMenuSheet({ visible, onClose }: Props) {
  const router = useRouter();

  function go(path: string) {
    onClose();
    router.push(path as any);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="More">
      <AppText variant="labelSm" color="textMuted" style={styles.sectionLabel}>ACCOUNTS & CATEGORIES</AppText>
      <MenuItem icon="layers" label="Accounts" onPress={() => go('/accounts')} />
      <MenuItem icon="tag" label="Categories" onPress={() => go('/categories')} />

      <AppText variant="labelSm" color="textMuted" style={[styles.sectionLabel, styles.sectionGap]}>ANALYTICS</AppText>
      <MenuItem icon="pie-chart" label="Budgets" onPress={() => go('/budgets')} />
      <MenuItem icon="bar-chart-2" label="Reports" onPress={() => go('/reports')} />

      <AppText variant="labelSm" color="textMuted" style={[styles.sectionLabel, styles.sectionGap]}>HELP</AppText>
      <MenuItem icon="help-circle" label="How to use Centav0" onPress={() => go('/onboarding/tutorial?replay=1')} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { letterSpacing: 0.8, marginBottom: theme.spacing[2] },
  sectionGap: { marginTop: theme.spacing[6] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[4],
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  pressed: { opacity: 0.6 },
  rowLabel: { flex: 1 },
});
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/ScreenHeader.tsx src/components/menu/MoreMenuSheet.tsx
git commit -m "feat: add shared screen header with More overflow menu"
```

---

## Task 7: Wire the header into every tab screen, remove the More tab

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/transactions.tsx`
- Modify: `app/(tabs)/debts.tsx`
- Delete: `app/(tabs)/more.tsx`
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: `app/(tabs)/index.tsx`** — replace the header block

Replace:
```typescript
          <View style={styles.header}>
            <AppText variant="h2">Dashboard</AppText>
          </View>
```
with:
```typescript
          <ScreenHeader title="Dashboard" />
```
Add the import near the other component imports:
```typescript
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
```

- [ ] **Step 2: `app/(tabs)/transactions.tsx`** — replace the header block

Replace:
```typescript
      <View style={styles.header}>
        <AppText variant="h2">Transactions</AppText>
      </View>
```
with:
```typescript
      <ScreenHeader title="Transactions" />
```
Add the import:
```typescript
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
```

- [ ] **Step 3: `app/(tabs)/debts.tsx`** — replace the title line

Replace:
```typescript
      <AppText variant="h2" style={styles.title}>Debts</AppText>
```
with:
```typescript
      <View style={styles.title}>
        <ScreenHeader title="Debts" />
      </View>
```
Add the import:
```typescript
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
```
(`styles.title` already provides the horizontal padding/margins; it now wraps `ScreenHeader` instead of styling `AppText` directly.)

- [ ] **Step 4: Delete `app/(tabs)/more.tsx`**

Its content has already been moved into `MoreMenuSheet` in Task 6.

- [ ] **Step 5: `app/(tabs)/_layout.tsx`** — swap the `more` tab for `lent`

Replace:
```typescript
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarAccessibilityLabel: 'More tab',
          tabBarIcon: ({ color, size }) => (
            <Feather name="menu" size={size ?? 20} color={color} />
          ),
        }}
      />
```
with:
```typescript
      <Tabs.Screen
        name="lent"
        options={{
          title: 'Lent',
          tabBarAccessibilityLabel: 'Lent tab',
          tabBarIcon: ({ color, size }) => (
            <Feather name="users" size={size ?? 20} color={color} />
          ),
        }}
      />
```

- [ ] **Step 6: Verify it compiles and runs**

Run: `npx tsc --noEmit`
Expected: no errors (this will fail until Task 10 creates `app/(tabs)/lent.tsx` — if so, stub it temporarily with a bare `export default function LentScreen() { return null; }` and replace it fully in Task 10).

Run the app, confirm: the bottom nav shows Home / Transactions / Debts / Lent (no More), and tapping the 3-dot icon on Dashboard, Transactions, and Debts opens the same More sheet that used to be its own tab.

- [ ] **Step 7: Commit**

```bash
git add app/\(tabs\)/index.tsx app/\(tabs\)/transactions.tsx app/\(tabs\)/debts.tsx app/\(tabs\)/_layout.tsx
git rm app/\(tabs\)/more.tsx
git commit -m "refactor: move More menu into header, replace More tab with Lent"
```

---

## Task 8: Add/Edit Lending sheet

**Files:**
- Create: `src/components/lending/AddLendingSheet.tsx`

- [ ] **Step 1: Create the sheet**

Person picker offers existing people plus a `__new__` option that reveals a name field. Amount + source account + date + note, mirroring `AddDebtSheet.tsx`. Editing a lending only allows changing the note (amount/person/account are fixed once money has moved — same rule as debts not allowing `originalAmount` edits).

`src/components/lending/AddLendingSheet.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AppTextInput } from '../ui/AppTextInput';
import { AmountInput } from '../ui/AmountInput';
import { DatePicker } from '../ui/DatePicker';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { lendingRepo, lendingPersonRepo, accountRepo } from '../../repositories';
import { theme } from '../../theme';
import { nowIso } from '../../utils/date';
import type { Lending, LendingPerson, Account } from '../../domain/types';

const NEW_PERSON = '__new__';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initial?: Lending;
};

export function AddLendingSheet({ visible, onClose, onSuccess, initial }: Props) {
  const isEdit = !!initial;
  const [people, setPeople] = useState<LendingPerson[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [personId, setPersonId] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(nowIso());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      lendingPersonRepo.list().then(setPeople);
      accountRepo.list().then(setAccounts);
      setPersonId(initial?.personId ?? '');
      setNewPersonName('');
      setAmount(0);
      setAccountId(initial?.accountId ?? '');
      setDate(initial?.date ?? nowIso());
      setNote(initial?.note ?? '');
      setErrors({});
    }
  }, [visible]);

  const personOptions = [
    ...people.map((p) => ({ label: p.name, value: p.id })),
    { label: '+ Add new person', value: NEW_PERSON },
  ];
  const accountOptions = accounts.map((a) => ({ label: a.name, value: a.id }));

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!isEdit) {
      if (!personId) errs.personId = 'Select a person';
      if (personId === NEW_PERSON && !newPersonName.trim()) errs.personId = 'Enter a name';
      if (amount <= 0) errs.amount = 'Enter an amount greater than 0';
      if (!accountId) errs.accountId = 'Select an account';
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      if (isEdit && initial) {
        await lendingRepo.update(initial.id, { note: note.trim() || undefined });
      } else {
        let resolvedPersonId = personId;
        if (personId === NEW_PERSON) {
          const created = await lendingPersonRepo.create({ name: newPersonName.trim() });
          resolvedPersonId = created.id;
        }
        await lendingRepo.create({
          personId: resolvedPersonId,
          amount,
          accountId,
          date,
          note: note.trim() || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (e) {
      setErrors({ amount: e instanceof Error ? e.message : 'Could not save lending' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={isEdit ? 'Edit Lending' : 'Lend Money'}>
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!isEdit && (
          <>
            <Select
              label="Person"
              options={personOptions}
              value={personId}
              onChange={setPersonId}
              placeholder="Select person…"
              error={errors.personId}
            />
            {personId === NEW_PERSON && (
              <AppTextInput
                label="New Person's Name"
                value={newPersonName}
                onChangeText={setNewPersonName}
                placeholder="e.g. Mom"
                autoFocus
              />
            )}
            <AmountInput
              label="Amount Lent"
              value={amount}
              onChange={setAmount}
              error={errors.amount}
            />
            <Select
              label="From Account"
              options={accountOptions}
              value={accountId}
              onChange={setAccountId}
              placeholder="Select account…"
              error={errors.accountId}
            />
            <DatePicker label="Date" value={date} onChange={setDate} />
          </>
        )}
        <AppTextInput
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Additional details"
        />
        <Button label={isEdit ? 'Save Changes' : 'Lend Money'} onPress={handleSave} loading={saving} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing[5] },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/lending/AddLendingSheet.tsx
git commit -m "feat: add lending creation/edit sheet"
```

---

## Task 9: Add Lending Payment sheet

**Files:**
- Create: `src/components/lending/AddLendingPaymentSheet.tsx`

- [ ] **Step 1: Create the sheet** (simplified `AddPaymentSheet` — no installment/accumulated-balance modes, since those are debt-specific and out of scope here)

`src/components/lending/AddLendingPaymentSheet.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AmountInput } from '../ui/AmountInput';
import { DatePicker } from '../ui/DatePicker';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { AppText } from '../ui/AppText';
import { lendingPaymentRepo, accountRepo } from '../../repositories';
import { theme } from '../../theme';
import { nowIso } from '../../utils/date';
import { formatPHP } from '../../utils/currency';
import type { Account } from '../../domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lendingId: string;
  personName: string;
  outstandingBalance: number;
};

type PayMode = 'full' | 'custom';

export function AddLendingPaymentSheet({ visible, onClose, onSuccess, lendingId, personName, outstandingBalance }: Props) {
  const [mode, setMode] = useState<PayMode>('full');
  const [customAmount, setCustomAmount] = useState(0);
  const [date, setDate] = useState(nowIso());
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setMode('full');
      setCustomAmount(0);
      setDate(nowIso());
      setAccountId('');
      setErrors({});
      accountRepo.list().then(setAccounts);
    }
  }, [visible]);

  const amount = mode === 'full' ? outstandingBalance : customAmount;
  const accountOptions = accounts.map((a) => ({ label: a.name, value: a.id }));

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (amount <= 0) errs.amount = 'Enter a payment amount';
    if (!accountId) errs.accountId = 'Select an account';
    if (amount > outstandingBalance) errs.amount = 'Payment is more than what is owed';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      await lendingPaymentRepo.create(lendingId, { amount, date, accountId });
      onSuccess();
      onClose();
    } catch (e) {
      setErrors({ amount: e instanceof Error ? e.message : 'Could not record payment' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Payment">
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.modeBlock}>
          <AppText variant="labelLg" color="textSecondary">Payment</AppText>
          <View style={styles.modeRow}>
            {(['full', 'custom'] as PayMode[]).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => { setMode(m); setErrors({}); }}
                  accessibilityRole="button"
                  accessibilityLabel={m === 'full' ? `Pay full, ${formatPHP(outstandingBalance)}` : 'Pay custom amount'}
                  accessibilityState={{ selected: active }}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                >
                  <AppText variant="labelLg" color={active ? 'accentPrimary' : 'textSecondary'}>
                    {m === 'full' ? 'Full' : 'Custom'}
                  </AppText>
                  <AppText variant={m === 'full' ? 'amountXs' : 'labelSm'} color={active ? 'textPrimary' : 'textMuted'}>
                    {m === 'full' ? formatPHP(outstandingBalance) : 'Enter amount'}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
        {mode === 'custom' && (
          <AmountInput
            label="Payment Amount"
            value={customAmount}
            onChange={setCustomAmount}
            error={errors.amount}
            autoFocus
          />
        )}
        <DatePicker label="Payment Date" value={date} onChange={setDate} />
        <Select
          label="To Account"
          options={accountOptions}
          value={accountId}
          onChange={setAccountId}
          placeholder="Select account…"
          error={errors.accountId}
        />
        {amount > 0 ? (
          <View style={styles.preview}>
            <AppText variant="bodySm" color="textMuted">
              {formatPHP(amount)} from {personName} to your account
            </AppText>
            <AppText variant="bodySm" color={outstandingBalance - amount > 0 ? 'textSecondary' : 'positive'}>
              Remaining owed: {formatPHP(Math.max(0, outstandingBalance - amount))}
            </AppText>
          </View>
        ) : null}
        <Button
          label={amount > 0 ? `Record ${formatPHP(amount)}` : 'Record Payment'}
          onPress={handleSave}
          loading={saving}
        />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing[5] },
  modeBlock: { gap: theme.spacing[3] },
  modeRow: { flexDirection: 'row', gap: theme.spacing[3] },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing[1],
    paddingVertical: theme.spacing[4],
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.bgInput,
  },
  modeChipActive: {
    borderColor: theme.colors.accentBorder,
    backgroundColor: theme.colors.accentSubtle,
  },
  preview: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.md,
    padding: theme.spacing[4],
    gap: theme.spacing[2],
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/lending/AddLendingPaymentSheet.tsx
git commit -m "feat: add lending payment sheet"
```

---

## Task 10: Lent tab screen (list)

**Files:**
- Create: `app/(tabs)/lent.tsx`

- [ ] **Step 1: Create the screen**, mirroring `app/(tabs)/debts.tsx`: `Active`/`Paid` tabs, summary card, person filter chips, swipe-to-edit rows, FAB.

`app/(tabs)/lent.tsx`:

```typescript
import React, { useState, useCallback, useRef } from 'react';
import { View, FlatList, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { Amount } from '../../src/components/ui/Amount';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FAB } from '../../src/components/ui/FAB';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { AddLendingSheet } from '../../src/components/lending/AddLendingSheet';
import { lendingRepo, lendingPaymentRepo, lendingPersonRepo, accountRepo } from '../../src/repositories';
import { theme } from '../../src/theme';
import { displayDate, monthRangeIso } from '../../src/utils/date';
import { formatPHP } from '../../src/utils/currency';
import type { Account, Lending, LendingPerson, LendingStatus } from '../../src/domain/types';

const TABS: LendingStatus[] = ['Active', 'Paid'];
const ALL_PEOPLE = '__all__';

type LendingRowProps = {
  lending: Lending;
  personName: string;
  paidTotal: number;
  onPress: (l: Lending) => void;
  onEdit: (l: Lending) => void;
};

function LendingRow({ lending, personName, paidTotal, onPress, onEdit }: LendingRowProps) {
  const swipeRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={() => { swipeRef.current?.close(); onEdit(lending); }}
          accessibilityRole="button"
          accessibilityLabel={`Edit lending to ${personName}`}
          style={styles.editAction}
        >
          <Feather name="edit-2" size={18} color={theme.colors.textPrimary} />
          <AppText variant="labelSm" color="textPrimary">Edit</AppText>
        </Pressable>
      )}
    >
      <Pressable
        onPress={() => onPress(lending)}
        accessibilityRole="button"
        accessibilityLabel={`View lending to ${personName}`}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={styles.iconCircle}>
          <Feather
            name="user"
            size={18}
            color={lending.status === 'Paid' ? theme.colors.positive : theme.colors.accentPrimary}
          />
        </View>
        <View style={styles.rowMain}>
          <AppText variant="body" style={styles.person}>{personName}</AppText>
          <AppText variant="bodySm" color="textMuted">{displayDate(lending.date)}</AppText>
        </View>
        <View style={styles.rowTrail}>
          {lending.status === 'Paid' ? (
            <View style={styles.paidTrail}>
              <AppText variant="labelSm" color="positive">PAID</AppText>
              <Amount value={paidTotal} variant="amountSm" semanticColor={false} color="positive" />
            </View>
          ) : (
            <Amount value={lending.outstandingBalance} variant="amountSm" semanticColor={false} />
          )}
          <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
        </View>
      </Pressable>
    </Swipeable>
  );
}

export default function LentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LendingStatus>('Active');
  const [personFilter, setPersonFilter] = useState(ALL_PEOPLE);
  const [lendings, setLendings] = useState<Lending[]>([]);
  const [people, setPeople] = useState<LendingPerson[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editLending, setEditLending] = useState<Lending | null>(null);
  const [paidTotals, setPaidTotals] = useState<Record<string, number>>({});
  const [paidBackThisMonth, setPaidBackThisMonth] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const all = await lendingRepo.list();
    const ppl = await lendingPersonRepo.list();
    const accs = await accountRepo.list();
    const allPayments = await lendingPaymentRepo.list();
    const totals: Record<string, number> = {};
    for (const p of allPayments) totals[p.lendingId] = (totals[p.lendingId] ?? 0) + p.amount;
    const { from, to } = monthRangeIso();
    const monthTotal = allPayments
      .filter((p) => p.date >= from && p.date <= to)
      .reduce((sum, p) => sum + p.amount, 0);
    setLendings(all);
    setPeople(ppl);
    setAccounts(accs);
    setPaidTotals(totals);
    setPaidBackThisMonth(monthTotal);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const personMap = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const byStatus = lendings.filter((l) => l.status === activeTab);
  const filtered = personFilter === ALL_PEOPLE ? byStatus : byStatus.filter((l) => l.personId === personFilter);
  const activeLendings = lendings.filter((l) => l.status !== 'Paid');
  const totalLentOut = activeLendings.reduce((sum, l) => sum + l.outstandingBalance, 0);
  const availableFunds = accounts
    .filter((a) => a.type === 'Cash' || a.type === 'EWallet')
    .reduce((sum, a) => sum + a.currentBalance, 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.headerWrap}>
        <ScreenHeader title="Lent" />
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="tab"
            accessibilityLabel={tab}
            accessibilityState={{ selected: activeTab === tab }}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
          >
            <AppText variant="labelLg" color={activeTab === tab ? 'accentPrimary' : 'textSecondary'}>
              {tab}
            </AppText>
          </Pressable>
        ))}
      </View>

      {people.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}
        >
          {[{ id: ALL_PEOPLE, name: 'All' }, ...people].map((p) => {
            const active = personFilter === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPersonFilter(p.id)}
                accessibilityRole="button"
                accessibilityLabel={p.name}
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <AppText variant="labelSm" color={active ? 'accentPrimary' : 'textSecondary'}>{p.name}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={theme.colors.accentPrimary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: 80 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.summary}>
              <View style={styles.summaryCol}>
                <AppText variant="labelSm" color="textMuted">LENT OUT</AppText>
                <AppText variant="amountMd" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {formatPHP(totalLentOut)}
                </AppText>
                <AppText variant="bodySm" color="textMuted">{activeLendings.length} active</AppText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <AppText variant="labelSm" color="textMuted">CASH + E-WALLETS</AppText>
                <AppText variant="amountMd" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {formatPHP(availableFunds)}
                </AppText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <AppText variant="labelSm" color="textMuted">PAID BACK THIS MONTH</AppText>
                <AppText variant="amountMd" color="positive" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {formatPHP(paidBackThisMonth)}
                </AppText>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title={`No ${activeTab.toLowerCase()} lendings`}
              subtitle={activeTab === 'Paid' ? 'Paid-back lendings will appear here' : 'Tap + to record money you lent out'}
            />
          }
          renderItem={({ item }) => (
            <LendingRow
              lending={item}
              personName={personMap[item.personId] ?? 'Unknown'}
              paidTotal={paidTotals[item.id] ?? 0}
              onPress={(l) => router.push(`/lent/${l.id}`)}
              onEdit={setEditLending}
            />
          )}
        />
      )}

      <FAB onPress={() => setSheetVisible(true)} accessibilityLabel="Add lending" />

      <AddLendingSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSuccess={load}
      />

      <AddLendingSheet
        visible={editLending !== null}
        initial={editLending ?? undefined}
        onClose={() => setEditLending(null)}
        onSuccess={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  headerWrap: {
    paddingHorizontal: theme.spacing[5],
    marginTop: theme.spacing[5],
    marginBottom: theme.spacing[4],
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[3],
    marginBottom: theme.spacing[4],
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing[3],
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: theme.colors.accentPrimary },
  chipsScroll: { flexGrow: 0, marginBottom: theme.spacing[4] },
  chips: { paddingHorizontal: theme.spacing[5], gap: theme.spacing[2] },
  chip: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.bgInput,
  },
  chipActive: { borderColor: theme.colors.accentBorder, backgroundColor: theme.colors.accentSubtle },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: theme.spacing[5] },
  summary: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
    flexDirection: 'row',
    gap: theme.spacing[4],
    marginBottom: theme.spacing[4],
    ...theme.shadows.sm,
  },
  summaryCol: { flex: 1, gap: theme.spacing[2] },
  summaryDivider: { width: 1, backgroundColor: theme.colors.borderDefault, marginHorizontal: theme.spacing[1] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.bgPrimary,
  },
  editAction: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    backgroundColor: theme.colors.bgElevated,
  },
  rowPressed: { opacity: 0.6 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing[4],
  },
  rowMain: { flex: 1, gap: theme.spacing[1] },
  person: { fontWeight: '600' },
  rowTrail: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  paidTrail: { alignItems: 'flex-end', gap: theme.spacing[1] },
});
```

- [ ] **Step 2: Verify it compiles and the tab is reachable**

Run: `npx tsc --noEmit`
Expected: no errors.

Run the app, tap the "Lent" tab, confirm the empty state renders, tap + and lend ₱200 from Cash to a new person "Mom": confirm Cash's balance on the Accounts screen (via the header menu → Accounts) drops by ₱200, and the Lent tab now shows Mom with ₱200 outstanding under Active.

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/lent.tsx
git commit -m "feat: add Lent tab list screen"
```

---

## Task 11: Lending detail screen

**Files:**
- Create: `app/lent/[id].tsx`

- [ ] **Step 1: Create the screen**, mirroring `app/debts/[id].tsx`

`app/lent/[id].tsx`:

```typescript
import React, { useState, useCallback } from 'react';
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { Amount } from '../../src/components/ui/Amount';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { AddLendingSheet } from '../../src/components/lending/AddLendingSheet';
import { AddLendingPaymentSheet } from '../../src/components/lending/AddLendingPaymentSheet';
import { lendingRepo, lendingPaymentRepo, lendingPersonRepo, accountRepo } from '../../src/repositories';
import { theme } from '../../src/theme';
import { displayDate } from '../../src/utils/date';
import { formatPHP } from '../../src/utils/currency';
import type { Lending, LendingPayment, Account } from '../../src/domain/types';

export default function LendingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [lending, setLending] = useState<Lending | null>(null);
  const [personName, setPersonName] = useState('');
  const [payments, setPayments] = useState<LendingPayment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const l = await lendingRepo.getById(id);
    const p = await lendingPaymentRepo.listByLending(id);
    const a = await accountRepo.list();
    if (l) {
      const person = await lendingPersonRepo.getById(l.personId);
      setPersonName(person?.name ?? 'Unknown');
    }
    setLending(l);
    setPayments(p);
    setAccounts(a);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  async function handleDelete() {
    if (!lending) return;
    await lendingRepo.softDelete(lending.id);
    router.back();
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={theme.colors.accentPrimary} size="large" />
      </View>
    );
  }

  if (!lending) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <AppText variant="body" color="textMuted">Lending not found.</AppText>
      </View>
    );
  }

  const statusColor = lending.status === 'Paid' ? 'positive' : 'accentPrimary';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={22} color={theme.colors.textPrimary} />
        </Pressable>
        <AppText variant="h2" style={styles.flex}>Lending Detail</AppText>
        <Pressable
          onPress={() => setEditVisible(true)}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Edit lending"
        >
          <Feather name="edit-2" size={18} color={theme.colors.accentPrimary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <AppText variant="h3" style={styles.flex}>{personName}</AppText>
            <AppText variant="labelLg" color={statusColor}>{lending.status}</AppText>
          </View>
          {lending.status === 'Paid' ? (
            <>
              <Amount value={totalPaid} variant="amountLg" semanticColor={false} color="positive" />
              <AppText variant="bodySm" color="textMuted" style={styles.originalLabel}>
                Fully paid back • {formatPHP(lending.amount)} lent
              </AppText>
            </>
          ) : (
            <>
              <Amount value={lending.outstandingBalance} variant="amountLg" semanticColor={false} />
              <AppText variant="bodySm" color="textMuted" style={styles.originalLabel}>
                of {formatPHP(lending.amount)} lent
              </AppText>
            </>
          )}
          <View style={styles.metaRow}>
            <Feather name="calendar" size={14} color={theme.colors.textMuted} />
            <AppText variant="bodySm" color="textMuted">Lent {displayDate(lending.date)}</AppText>
          </View>
          {lending.note ? (
            <AppText variant="bodySm" color="textMuted" style={styles.note}>{lending.note}</AppText>
          ) : null}
        </Card>

        {lending.status !== 'Paid' && (
          <View style={styles.actions}>
            <Button
              label="Add Payment"
              onPress={() => setPaymentVisible(true)}
              style={styles.flex}
            />
          </View>
        )}

        <AppText variant="h3" style={styles.sectionTitle}>Payment History</AppText>

        {payments.length === 0 ? (
          <EmptyState icon="dollar-sign" title="No payments yet" subtitle="Record a payback above" />
        ) : (
          payments.map((p) => (
            <View key={p.id} style={styles.paymentRow}>
              <View style={styles.paymentIconCircle}>
                <Feather name="dollar-sign" size={18} color={theme.colors.positive} />
              </View>
              <View style={styles.paymentInfo}>
                <AppText variant="body">{displayDate(p.date)}</AppText>
                <AppText variant="bodySm" color="textMuted">
                  to {accountMap[p.accountId] ?? 'Unknown account'}
                </AppText>
              </View>
              <Amount value={p.amount} variant="amountSm" color="positive" semanticColor={false} />
            </View>
          ))
        )}

        <Pressable
          onPress={() => setDeleteVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Delete lending"
          style={styles.deleteBtn}
        >
          <Feather name="trash-2" size={16} color={theme.colors.negative} />
          <AppText variant="body" color="negative">Delete Lending</AppText>
        </Pressable>
      </ScrollView>

      <AddLendingSheet
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        onSuccess={load}
        initial={lending}
      />

      <AddLendingPaymentSheet
        visible={paymentVisible}
        onClose={() => setPaymentVisible(false)}
        onSuccess={load}
        lendingId={lending.id}
        personName={personName}
        outstandingBalance={lending.outstandingBalance}
      />

      <ConfirmDialog
        visible={deleteVisible}
        title="Delete Lending"
        message={`Delete lending to "${personName}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteVisible(false)}
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[4],
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -theme.spacing[2],
  },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: theme.spacing[5], gap: theme.spacing[5] },
  summaryCard: { gap: theme.spacing[2] },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] },
  originalLabel: { marginTop: theme.spacing[1] },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    marginTop: theme.spacing[2],
  },
  note: { marginTop: theme.spacing[3], fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: theme.spacing[3] },
  sectionTitle: {},
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  paymentIconCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing[4],
  },
  paymentInfo: { flex: 1, gap: theme.spacing[1] },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[5],
    marginTop: theme.spacing[3],
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual end-to-end verification** (this is the plan's one required check for the money-moving logic — see Testing section of the spec)

In the running app:
1. Note Cash account balance (Accounts, via header menu).
2. Lent tab → + → lend ₱200 from Cash to new person "Mom" → confirm Cash balance dropped by ₱200 and Mom appears under Active with ₱200 outstanding.
3. Tap into Mom's lending → Add Payment → Full (₱200) → to Cash → confirm Cash balance is back to its original value, lending flips to Paid, and shows under the Paid tab.
4. From the lending detail screen, delete the lending → confirm Cash balance increases by another ₱200 (this is intentional and matches existing `SqliteDebtRepository.softDelete` behavior for a fully-paid debt: `softDelete` always refunds the original `amount` regardless of `outstandingBalance`, so deleting a `Paid` record is a deliberate "undo the whole thing including the payback" action, not a no-op). If this surprises you, verify by deleting a fully-paid debt in the existing Debts tab — if that produces the same doubled credit, no fix is needed; the two features are meant to behave identically.

- [ ] **Step 4: Commit**

```bash
git add app/lent/\[id\].tsx
git commit -m "feat: add lending detail screen with payment history"
```

---

## Task 12: Final full pass

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: zero errors across the whole project.

- [ ] **Step 2: `npx expo-doctor`**

Expected: no new warnings introduced by this feature (per `AGENTS.md` branch policy, this repo runs Expo SDK 54 — do not upgrade Expo as part of this feature).

- [ ] **Step 3: Full manual walkthrough**

- Bottom nav: Home, Transactions, Debts, Lent (no More).
- 3-dot icon on Home, Transactions, Debts opens the same More sheet (Accounts, Categories, Budgets, Reports, How to use Centav0).
- Lent tab: add a lending, edit its note, filter by person chip, add a partial payment, confirm outstanding balance decreases and account balances move correctly both ways, mark fully paid, confirm it moves to the Paid tab, delete it.

- [ ] **Step 4: Commit** (only if Step 3 surfaced fixes; otherwise nothing to commit)
