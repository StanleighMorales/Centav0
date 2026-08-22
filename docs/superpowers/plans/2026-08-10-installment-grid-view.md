# Installment Loan Grid View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third `Grid` view mode to the Debts screen showing installment loans as rows and months of a selected year as columns, with per-cell principal+interest amounts, a whole-loan total column, and a shared coverage summary.

**Architecture:** Two new nullable columns on `debts` (`termMonths`, `monthlyInterest`) via a new migration; a pure `buildSchedule(debt)` function turns a `Debt` into a list of monthly cells (no new queries); a new `InstallmentGridView` component renders the grid and reuses a small shared `stillNeeded` helper that `MonthlyDebtView` is refactored to call too, instead of duplicating the coverage formula.

**Tech Stack:** Expo 57 / React Native / TypeScript / expo-sqlite. No test framework in this repo — pure-logic modules get a `.check.mts` self-check (`node --experimental-strip-types <file>`), matching the existing `src/utils/calc.check.mts` pattern. UI is verified via `npx tsc --noEmit` plus manual on-device check per `AGENTS.md` (EAS dev client, not web — native `DatePicker` doesn't work in a browser).

**Spec:** `docs/superpowers/specs/2026-08-09-installment-grid-view-design.md`

---

### Task 1: Migration — `termMonths` and `monthlyInterest` columns

**Files:**
- Modify: `src/db/migrations.ts:324-335`

- [ ] **Step 1: Add migration `015_installment_schedule`**

In `src/db/migrations.ts`, insert a new entry into the `MIGRATIONS` array immediately after the `014_savings_account_types` entry (currently the last one, ending at line 335) and before the closing `];`:

```ts
  {
    name: '015_installment_schedule',
    up: async (db) => {
      await db.execAsync(`
        ALTER TABLE debts ADD COLUMN termMonths INTEGER;
        ALTER TABLE debts ADD COLUMN monthlyInterest REAL;
      `);
    },
  },
```

- [ ] **Step 2: Verify the file still type-checks**

Run: `npx tsc --noEmit`
Expected: no errors (this is a plain data-only change, nothing references the new columns yet).

- [ ] **Step 3: Commit**

```bash
git add src/db/migrations.ts
git commit -m "feat: add termMonths and monthlyInterest columns to debts"
```

---

### Task 2: Domain types — `termMonths` and `monthlyInterest`

**Files:**
- Modify: `src/domain/types.ts:105-137`

- [ ] **Step 1: Add fields to `Debt`**

In `src/domain/types.ts`, the `Debt` interface currently ends:

```ts
  isInstallment: boolean;
  monthlyPayment: number | null;
  installmentFee: number | null;
}
```

Change to:

```ts
  isInstallment: boolean;
  monthlyPayment: number | null;
  installmentFee: number | null;
  /** Total number of scheduled months for the installment plan. Installment loans only. */
  termMonths: number | null;
  /** Flat interest amount added on top of monthlyPayment each scheduled month. Installment loans only. */
  monthlyInterest: number | null;
}
```

- [ ] **Step 2: Add fields to `CreateDebtInput` and `UpdateDebtInput`**

Current:

```ts
export interface CreateDebtInput {
  creditor: string; originalAmount: number; debtType: DebtType;
  /** Required when debtType === 'Loan'. Account to credit with originalAmount. */
  accountId?: string;
  dueDate?: string; interestRate?: number; note?: string;
  isInstallment?: boolean; monthlyPayment?: number; installmentFee?: number;
}
export interface UpdateDebtInput {
  creditor?: string; dueDate?: string; interestRate?: number; note?: string;
  isInstallment?: boolean; monthlyPayment?: number; installmentFee?: number;
}
```

Change to:

```ts
export interface CreateDebtInput {
  creditor: string; originalAmount: number; debtType: DebtType;
  /** Required when debtType === 'Loan'. Account to credit with originalAmount. */
  accountId?: string;
  dueDate?: string; interestRate?: number; note?: string;
  isInstallment?: boolean; monthlyPayment?: number; installmentFee?: number;
  termMonths?: number; monthlyInterest?: number;
}
export interface UpdateDebtInput {
  creditor?: string; dueDate?: string; interestRate?: number; note?: string;
  isInstallment?: boolean; monthlyPayment?: number; installmentFee?: number;
  termMonths?: number; monthlyInterest?: number;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: FAIL — `SqliteDebtRepository.ts`'s `rowToDebt` no longer satisfies the `Debt` type (missing `termMonths`/`monthlyInterest`). This confirms the type change took effect; Task 3 fixes it.

- [ ] **Step 4: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat: add termMonths and monthlyInterest to Debt domain types"
```

---

### Task 3: Repository — read/write the new fields

**Files:**
- Modify: `src/repositories/sqlite/SqliteDebtRepository.ts`

- [ ] **Step 1: Map the new columns in `rowToDebt`**

Current (`src/repositories/sqlite/SqliteDebtRepository.ts:10-26`):

```ts
function rowToDebt(row: any): Debt {
  return {
    id: row.id, userId: row.userId, creditor: row.creditor,
    originalAmount: row.originalAmount, outstandingBalance: row.outstandingBalance,
    dueDate: row.dueDate ?? null, status: row.status,
    debtType: row.debtType, disbursementAccountId: row.disbursementAccountId ?? null,
    linkedAccountId: row.linkedAccountId ?? null,
    disbursementTransactionId: row.disbursementTransactionId ?? null,
    interestRate: row.interestRate ?? null, note: row.note ?? null,
    isInstallment: row.isInstallment === 1,
    monthlyPayment: row.monthlyPayment ?? null,
    installmentFee: row.installmentFee ?? null,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}
```

Change to:

```ts
function rowToDebt(row: any): Debt {
  return {
    id: row.id, userId: row.userId, creditor: row.creditor,
    originalAmount: row.originalAmount, outstandingBalance: row.outstandingBalance,
    dueDate: row.dueDate ?? null, status: row.status,
    debtType: row.debtType, disbursementAccountId: row.disbursementAccountId ?? null,
    linkedAccountId: row.linkedAccountId ?? null,
    disbursementTransactionId: row.disbursementTransactionId ?? null,
    interestRate: row.interestRate ?? null, note: row.note ?? null,
    isInstallment: row.isInstallment === 1,
    monthlyPayment: row.monthlyPayment ?? null,
    installmentFee: row.installmentFee ?? null,
    termMonths: row.termMonths ?? null,
    monthlyInterest: row.monthlyInterest ?? null,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
  };
}
```

- [ ] **Step 2: Write the new columns in `create`**

Current (`src/repositories/sqlite/SqliteDebtRepository.ts:83-93`):

```ts
      await db.runAsync(
        `INSERT INTO debts (id, userId, creditor, originalAmount, outstandingBalance, dueDate, status, debtType, disbursementAccountId, disbursementTransactionId, interestRate, note, isInstallment, monthlyPayment, installmentFee, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
        [
          id, FIXED_USER_ID, input.creditor, amount, amount, dueDate, status,
          input.debtType, disbursementAccountId, disbursementTransactionId,
          input.interestRate ?? null, input.note ?? null,
          input.isInstallment ? 1 : 0, input.monthlyPayment ?? null, input.installmentFee ?? null,
          now, now,
        ],
      );
```

Change to:

```ts
      await db.runAsync(
        `INSERT INTO debts (id, userId, creditor, originalAmount, outstandingBalance, dueDate, status, debtType, disbursementAccountId, disbursementTransactionId, interestRate, note, isInstallment, monthlyPayment, installmentFee, termMonths, monthlyInterest, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
        [
          id, FIXED_USER_ID, input.creditor, amount, amount, dueDate, status,
          input.debtType, disbursementAccountId, disbursementTransactionId,
          input.interestRate ?? null, input.note ?? null,
          input.isInstallment ? 1 : 0, input.monthlyPayment ?? null, input.installmentFee ?? null,
          input.termMonths ?? null, input.monthlyInterest ?? null,
          now, now,
        ],
      );
```

- [ ] **Step 3: Write the new columns in `update`**

Current (`src/repositories/sqlite/SqliteDebtRepository.ts:120-132`):

```ts
    await db.runAsync(
      `UPDATE debts SET creditor = ?, dueDate = ?, status = ?, interestRate = ?, note = ?, isInstallment = ?, monthlyPayment = ?, installmentFee = ?, updatedAt = ?, isDirty = 1
       WHERE id = ? AND userId = ?`,
      [
        input.creditor ?? existing.creditor, dueDate, status,
        'interestRate' in input ? (input.interestRate ?? null) : existing.interestRate,
        'note' in input ? (input.note ?? null) : existing.note,
        ('isInstallment' in input ? !!input.isInstallment : existing.isInstallment) ? 1 : 0,
        'monthlyPayment' in input ? (input.monthlyPayment ?? null) : existing.monthlyPayment,
        'installmentFee' in input ? (input.installmentFee ?? null) : existing.installmentFee,
        now, id, FIXED_USER_ID,
      ],
    );
```

Change to:

```ts
    await db.runAsync(
      `UPDATE debts SET creditor = ?, dueDate = ?, status = ?, interestRate = ?, note = ?, isInstallment = ?, monthlyPayment = ?, installmentFee = ?, termMonths = ?, monthlyInterest = ?, updatedAt = ?, isDirty = 1
       WHERE id = ? AND userId = ?`,
      [
        input.creditor ?? existing.creditor, dueDate, status,
        'interestRate' in input ? (input.interestRate ?? null) : existing.interestRate,
        'note' in input ? (input.note ?? null) : existing.note,
        ('isInstallment' in input ? !!input.isInstallment : existing.isInstallment) ? 1 : 0,
        'monthlyPayment' in input ? (input.monthlyPayment ?? null) : existing.monthlyPayment,
        'installmentFee' in input ? (input.installmentFee ?? null) : existing.installmentFee,
        'termMonths' in input ? (input.termMonths ?? null) : existing.termMonths,
        'monthlyInterest' in input ? (input.monthlyInterest ?? null) : existing.monthlyInterest,
        now, id, FIXED_USER_ID,
      ],
    );
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/sqlite/SqliteDebtRepository.ts
git commit -m "feat: persist termMonths and monthlyInterest in SqliteDebtRepository"
```

---

### Task 4: Pure schedule builder — `installmentSchedule.ts`

**Files:**
- Create: `src/utils/installmentSchedule.ts`
- Create: `src/utils/installmentSchedule.check.mts`

- [ ] **Step 1: Write the self-check first**

Create `src/utils/installmentSchedule.check.mts`:

```ts
// Self-check for installmentSchedule.ts. No test framework in this repo — run it directly:
//   node --experimental-strip-types src/utils/installmentSchedule.check.mts
import assert from 'node:assert';
import { buildSchedule, wholeLoanTotal, type ScheduleMonth } from './installmentSchedule.ts';
import type { Debt } from '../domain/types.ts';

function makeDebt(overrides: Partial<Debt>): Debt {
  return {
    id: 'd1', userId: 'u1', creditor: 'Test Lender',
    originalAmount: 10000, outstandingBalance: 10000,
    dueDate: '2026-01-15T00:00:00.000Z', status: 'Open', debtType: 'Loan',
    disbursementAccountId: null, linkedAccountId: null, disbursementTransactionId: null,
    interestRate: null, note: null,
    isInstallment: true, monthlyPayment: 2000, installmentFee: 100,
    termMonths: 5, monthlyInterest: 50,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null, isDirty: false, syncedAt: null,
    ...overrides,
  };
}

// Basic shape: 5 months, ascending due dates one month apart.
{
  const schedule = buildSchedule(makeDebt({}));
  assert.strictEqual(schedule.length, 5, 'termMonths=5 produces 5 rows');
  assert.strictEqual(new Date(schedule[0].dueDate).getUTCMonth(), 0, 'month 0 due in Jan');
  assert.strictEqual(new Date(schedule[1].dueDate).getUTCMonth(), 1, 'month 1 due in Feb');
  assert.strictEqual(new Date(schedule[4].dueDate).getUTCMonth(), 4, 'month 4 due in May');
}

// Fee folds into month 0 only.
{
  const schedule = buildSchedule(makeDebt({}));
  assert.strictEqual(schedule[0].amount, 2000 + 50 + 100, 'month 0 includes fee');
  assert.strictEqual(schedule[1].amount, 2000 + 50, 'month 1 excludes fee');
}

// monthsPaid derived from originalAmount - outstandingBalance.
{
  // 2 payments of 2000 made: outstandingBalance dropped from 10000 to 6000.
  const schedule = buildSchedule(makeDebt({ outstandingBalance: 6000 }));
  assert.strictEqual(schedule[0].status, 'paid');
  assert.strictEqual(schedule[1].status, 'paid');
  assert.strictEqual(schedule[2].status, 'due');
  assert.strictEqual(schedule[3].status, 'upcoming');
  assert.strictEqual(schedule[4].status, 'upcoming');
}

// monthsPaid clamps at termMonths even if outstandingBalance overshoots to 0.
{
  const schedule = buildSchedule(makeDebt({ outstandingBalance: 0 }));
  assert.ok(schedule.every((m) => m.status === 'paid'), 'fully paid loan marks every month paid');
}

// Non-installment or missing term/payment yields an empty schedule.
{
  assert.deepStrictEqual(buildSchedule(makeDebt({ isInstallment: false })), []);
  assert.deepStrictEqual(buildSchedule(makeDebt({ termMonths: null })), []);
  assert.deepStrictEqual(buildSchedule(makeDebt({ monthlyPayment: null })), []);
  assert.deepStrictEqual(buildSchedule(makeDebt({ monthlyPayment: 0 })), []);
  assert.deepStrictEqual(buildSchedule(makeDebt({ dueDate: null })), []);
}

// Day-of-month clamps across shorter months (Jan 31 -> Feb 28).
{
  const schedule = buildSchedule(makeDebt({ dueDate: '2026-01-31T00:00:00.000Z', termMonths: 2 }));
  const feb = new Date(schedule[1].dueDate);
  assert.strictEqual(feb.getMonth(), 1, 'clamped date still lands in February');
  assert.ok(feb.getDate() <= 28, 'clamped to a valid February day');
}

// Whole-loan total: (payment + interest) * term + one-time fee.
{
  const total = wholeLoanTotal(makeDebt({}));
  assert.strictEqual(total, (2000 + 50) * 5 + 100);
}

console.log('installmentSchedule.ts: all checks passed');
```

- [ ] **Step 2: Run it to confirm it fails (module doesn't exist yet)**

Run: `node --experimental-strip-types src/utils/installmentSchedule.check.mts`
Expected: FAIL with a module-not-found error for `./installmentSchedule.ts`.

- [ ] **Step 3: Implement `installmentSchedule.ts`**

Create `src/utils/installmentSchedule.ts`:

```ts
import type { Debt } from '../domain/types';

export type ScheduleStatus = 'paid' | 'due' | 'upcoming';

export interface ScheduleMonth {
  index: number;
  dueDate: string;
  principal: number;
  interest: number;
  fee: number;
  amount: number;
  status: ScheduleStatus;
}

// Advances `iso` by `months`, using the JS Date constructor's own
// day-of-month clamping (e.g. Jan 31 + 1 month -> Feb 28), same approach
// as nextDueDateIso in date.ts but for an arbitrary starting date instead
// of "next occurrence from today".
function addMonthsClamped(iso: string, months: number): string {
  const d = new Date(iso);
  return new Date(
    d.getFullYear(), d.getMonth() + months, d.getDate(),
    d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds(),
  ).toISOString();
}

/** Builds the full month-by-month schedule for an installment loan. Empty array if the debt isn't a valid installment plan. */
export function buildSchedule(debt: Debt): ScheduleMonth[] {
  if (!debt.isInstallment || !debt.dueDate || !debt.termMonths || debt.termMonths <= 0) return [];
  const monthlyPayment = debt.monthlyPayment ?? 0;
  if (monthlyPayment <= 0) return [];
  const monthlyInterest = debt.monthlyInterest ?? 0;
  const fee = debt.installmentFee ?? 0;

  const monthsPaid = Math.min(
    debt.termMonths,
    Math.max(0, Math.floor((debt.originalAmount - debt.outstandingBalance) / monthlyPayment)),
  );

  const months: ScheduleMonth[] = [];
  for (let i = 0; i < debt.termMonths; i++) {
    const isFirst = i === 0;
    const monthFee = isFirst ? fee : 0;
    months.push({
      index: i,
      dueDate: addMonthsClamped(debt.dueDate, i),
      principal: monthlyPayment,
      interest: monthlyInterest,
      fee: monthFee,
      amount: monthlyPayment + monthlyInterest + monthFee,
      status: i < monthsPaid ? 'paid' : i === monthsPaid ? 'due' : 'upcoming',
    });
  }
  return months;
}

/** Total amount paid over the loan's full term: (payment + interest) * term + one-time fee. */
export function wholeLoanTotal(debt: Debt): number {
  if (!debt.termMonths) return 0;
  const monthlyPayment = debt.monthlyPayment ?? 0;
  const monthlyInterest = debt.monthlyInterest ?? 0;
  const fee = debt.installmentFee ?? 0;
  return (monthlyPayment + monthlyInterest) * debt.termMonths + fee;
}
```

- [ ] **Step 4: Run the self-check to confirm it passes**

Run: `node --experimental-strip-types src/utils/installmentSchedule.check.mts`
Expected: `installmentSchedule.ts: all checks passed`

- [ ] **Step 5: Commit**

```bash
git add src/utils/installmentSchedule.ts src/utils/installmentSchedule.check.mts
git commit -m "feat: add pure installment schedule builder with self-check"
```

---

### Task 5: Shared coverage helper — `debtCoverage.ts`

**Files:**
- Create: `src/utils/debtCoverage.ts`
- Modify: `src/components/debts/MonthlyDebtView.tsx`

- [ ] **Step 1: Create the shared helper**

Create `src/utils/debtCoverage.ts`:

```ts
/** How much more the user still needs, after available funds and expected income are applied against what's due. Never negative. */
export function stillNeeded(totalDue: number, availableFunds: number, expectedIncome: number): number {
  return Math.max(0, totalDue - availableFunds - expectedIncome);
}
```

- [ ] **Step 2: Refactor `MonthlyDebtView` to use it**

In `src/components/debts/MonthlyDebtView.tsx`, add the import alongside the other utility imports:

```ts
import { stillNeeded } from '../../utils/debtCoverage';
```

Then replace this line:

```ts
  const stillNeeded = Math.max(0, totalDue - availableFunds - expectedIncome);
```

with:

```ts
  const stillNeededAmount = stillNeeded(totalDue, availableFunds, expectedIncome);
```

(Renamed the local variable to `stillNeededAmount` since it would otherwise shadow the imported function name.) Update the two remaining usages further down in the same file — the `Amount value={stillNeeded} ...` prop and its `color={stillNeeded > 0 ? 'negative' : 'positive'}` — to `stillNeededAmount`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors, no leftover references to the old `stillNeeded` local variable.

- [ ] **Step 4: Commit**

```bash
git add src/utils/debtCoverage.ts src/components/debts/MonthlyDebtView.tsx
git commit -m "refactor: extract shared stillNeeded coverage helper from MonthlyDebtView"
```

---

### Task 6: `AddDebtSheet` — Term and Monthly Interest fields

**Files:**
- Modify: `src/components/debts/AddDebtSheet.tsx`

- [ ] **Step 1: Add local state**

In `src/components/debts/AddDebtSheet.tsx`, next to the existing installment state (currently `isInstallment`, `monthlyPayment`, `installmentFee`):

```ts
  const [isInstallment, setIsInstallment] = useState(false);
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [installmentFee, setInstallmentFee] = useState(0);
```

Change to:

```ts
  const [isInstallment, setIsInstallment] = useState(false);
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [installmentFee, setInstallmentFee] = useState(0);
  const [termMonths, setTermMonths] = useState('');
  const [monthlyInterest, setMonthlyInterest] = useState(0);
```

- [ ] **Step 2: Reset/populate on open**

Current effect body includes:

```ts
      setIsInstallment(initial?.isInstallment ?? false);
      setMonthlyPayment(initial?.monthlyPayment ?? 0);
      setInstallmentFee(initial?.installmentFee ?? 0);
```

Change to:

```ts
      setIsInstallment(initial?.isInstallment ?? false);
      setMonthlyPayment(initial?.monthlyPayment ?? 0);
      setInstallmentFee(initial?.installmentFee ?? 0);
      setTermMonths(initial?.termMonths != null ? String(initial.termMonths) : '');
      setMonthlyInterest(initial?.monthlyInterest ?? 0);
```

- [ ] **Step 3: Validate and submit**

Current validation:

```ts
    if (isInstallment && monthlyPayment <= 0) errs.monthlyPayment = 'Enter the monthly payment';
```

Add directly below it:

```ts
    if (isInstallment && (!termMonths.trim() || parseInt(termMonths, 10) <= 0)) {
      errs.termMonths = 'Enter the number of months';
    }
```

Current `installmentFields` object:

```ts
      const installmentFields = {
        isInstallment,
        monthlyPayment: isInstallment ? monthlyPayment : undefined,
        installmentFee: isInstallment && installmentFee > 0 ? installmentFee : undefined,
      };
```

Change to:

```ts
      const installmentFields = {
        isInstallment,
        monthlyPayment: isInstallment ? monthlyPayment : undefined,
        installmentFee: isInstallment && installmentFee > 0 ? installmentFee : undefined,
        termMonths: isInstallment ? parseInt(termMonths, 10) : undefined,
        monthlyInterest: isInstallment && monthlyInterest > 0 ? monthlyInterest : undefined,
      };
```

- [ ] **Step 4: Add the form fields**

Current installment block:

```tsx
        {isInstallment && (
          <>
            <AmountInput
              label="Monthly Payment"
              value={monthlyPayment}
              onChange={setMonthlyPayment}
              error={errors.monthlyPayment}
            />
            <AmountInput
              label="Other Fees (optional)"
              value={installmentFee}
              onChange={setInstallmentFee}
            />
          </>
        )}
```

Change to:

```tsx
        {isInstallment && (
          <>
            <AmountInput
              label="Monthly Payment"
              value={monthlyPayment}
              onChange={setMonthlyPayment}
              error={errors.monthlyPayment}
            />
            <AppTextInput
              label="Term (months)"
              value={termMonths}
              onChangeText={setTermMonths}
              placeholder="e.g. 12"
              error={errors.termMonths}
              numeric
            />
            <AmountInput
              label="Monthly Interest (optional)"
              value={monthlyInterest}
              onChange={setMonthlyInterest}
            />
            <AmountInput
              label="Other Fees (optional)"
              value={installmentFee}
              onChange={setInstallmentFee}
            />
          </>
        )}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `grep -n "'#[0-9A-Fa-f]\{3,6\}'" src/components/debts/AddDebtSheet.tsx; grep -n "fontSize: [0-9]" src/components/debts/AddDebtSheet.tsx; grep -n "padding: [0-9]" src/components/debts/AddDebtSheet.tsx`
Expected: no output (no raw design values introduced — new fields use existing `AppTextInput`/`AmountInput` components, no new styles).

- [ ] **Step 6: Commit**

```bash
git add src/components/debts/AddDebtSheet.tsx
git commit -m "feat: add Term (months) and Monthly Interest fields to AddDebtSheet"
```

---

### Task 7: `InstallmentGridView` component

**Files:**
- Create: `src/components/debts/InstallmentGridView.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/debts/InstallmentGridView.tsx`:

```tsx
import React, { useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../ui/AppText';
import { Amount } from '../ui/Amount';
import { EmptyState } from '../ui/EmptyState';
import { BottomSheet } from '../ui/BottomSheet';
import { theme } from '../../theme';
import { displayDate } from '../../utils/date';
import { formatPHP } from '../../utils/currency';
import { spendableAccounts } from '../../utils/accumulated';
import { stillNeeded } from '../../utils/debtCoverage';
import { buildSchedule, wholeLoanTotal, type ScheduleMonth } from '../../utils/installmentSchedule';
import type { Account, Debt } from '../../domain/types';

type Props = { debts: Debt[]; accounts: Account[] };

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CELL_WIDTH = 84;
const NAME_WIDTH = 140;
const TOTAL_WIDTH = 96;

type LoanRow = { debt: Debt; schedule: ScheduleMonth[] };

function statusColor(status: ScheduleMonth['status']): keyof typeof theme.colors {
  if (status === 'paid') return 'textMuted';
  if (status === 'due') return 'accentPrimary';
  return 'textPrimary';
}

export function InstallmentGridView({ debts, accounts }: Props) {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [detailCell, setDetailCell] = useState<{ debt: Debt; month: ScheduleMonth } | null>(null);

  const rows: LoanRow[] = debts
    .filter((d) => d.debtType === 'Loan' && d.isInstallment && d.termMonths)
    .map((debt) => ({ debt, schedule: buildSchedule(debt) }))
    .filter((row) => row.schedule.some((m) => new Date(m.dueDate).getFullYear() === selectedYear));

  const now = new Date();
  const currentMonthTotal = rows.reduce((sum, row) => {
    const monthCell = row.schedule.find((m) => {
      const d = new Date(m.dueDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    return sum + (monthCell?.amount ?? 0);
  }, 0);
  const availableFunds = spendableAccounts(accounts).reduce((sum, a) => sum + a.currentBalance, 0);
  const stillNeededAmount = stillNeeded(currentMonthTotal, availableFunds, 0);

  return (
    <View style={styles.container}>
      <View style={styles.nav}>
        <Pressable
          onPress={() => setSelectedYear((y) => y - 1)}
          accessibilityRole="button"
          accessibilityLabel="Previous year"
          hitSlop={12}
        >
          <Feather name="chevron-left" size={22} color={theme.colors.textPrimary} />
        </Pressable>
        <AppText variant="h3">{selectedYear}</AppText>
        <Pressable
          onPress={() => setSelectedYear((y) => y + 1)}
          accessibilityRole="button"
          accessibilityLabel="Next year"
          hitSlop={12}
        >
          <Feather name="chevron-right" size={22} color={theme.colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <AppText variant="bodySm" color="textMuted">Due This Month</AppText>
          <Amount value={currentMonthTotal} variant="amountSm" semanticColor={false} />
        </View>
        <View style={styles.summaryRow}>
          <AppText variant="bodySm" color="textMuted">Available Funds</AppText>
          <Amount value={availableFunds} variant="amountSm" semanticColor={false} />
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <AppText variant="labelLg">Still Needed</AppText>
          <Amount
            value={stillNeededAmount}
            variant="amountMd"
            semanticColor={false}
            color={stillNeededAmount > 0 ? 'negative' : 'positive'}
          />
        </View>
      </View>

      {rows.length === 0 ? (
        <EmptyState icon="grid" title={`No installment loans scheduled in ${selectedYear}`} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.headerRow}>
              <View style={[styles.nameCell, { width: NAME_WIDTH }]} />
              {MONTH_LABELS.map((label) => (
                <View key={label} style={[styles.monthCell, { width: CELL_WIDTH }]}>
                  <AppText variant="labelSm" color="textMuted">{label}</AppText>
                </View>
              ))}
              <View style={[styles.monthCell, { width: TOTAL_WIDTH }]}>
                <AppText variant="labelSm" color="textMuted">Total</AppText>
              </View>
            </View>

            {rows.map(({ debt, schedule }) => (
              <View key={debt.id} style={styles.row}>
                <Pressable
                  style={[styles.nameCell, { width: NAME_WIDTH }]}
                  onPress={() => router.push(`/debts/${debt.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`View debt from ${debt.creditor}`}
                >
                  <AppText variant="body" numberOfLines={1}>{debt.creditor}</AppText>
                </Pressable>
                {MONTH_LABELS.map((_, monthIndex) => {
                  const cell = schedule.find((m) => {
                    const d = new Date(m.dueDate);
                    return d.getFullYear() === selectedYear && d.getMonth() === monthIndex;
                  });
                  return (
                    <Pressable
                      key={monthIndex}
                      style={[styles.monthCell, { width: CELL_WIDTH }]}
                      disabled={!cell}
                      onPress={() => cell && setDetailCell({ debt, month: cell })}
                      accessibilityRole="button"
                      accessibilityLabel={
                        cell ? `${debt.creditor} ${MONTH_LABELS[monthIndex]} ${formatPHP(cell.amount)}, ${cell.status}` : 'No payment scheduled'
                      }
                    >
                      {cell ? (
                        <>
                          <AppText variant="amountXs" color={statusColor(cell.status)}>
                            {formatPHP(cell.amount)}
                          </AppText>
                          {cell.interest > 0 ? (
                            <AppText variant="labelSm" color="textMuted">
                              incl. {formatPHP(cell.interest)} int
                            </AppText>
                          ) : null}
                        </>
                      ) : (
                        <AppText variant="bodySm" color="textMuted">—</AppText>
                      )}
                    </Pressable>
                  );
                })}
                <View style={[styles.monthCell, { width: TOTAL_WIDTH }]}>
                  <Amount value={wholeLoanTotal(debt)} variant="amountXs" semanticColor={false} />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <BottomSheet
        visible={detailCell !== null}
        onClose={() => setDetailCell(null)}
        title={detailCell ? `${detailCell.debt.creditor} — Month ${detailCell.month.index + 1}` : undefined}
      >
        {detailCell ? (
          <View style={styles.detail}>
            <View style={styles.detailRow}>
              <AppText variant="bodySm" color="textMuted">Due Date</AppText>
              <AppText variant="body">{displayDate(detailCell.month.dueDate)}</AppText>
            </View>
            <View style={styles.detailRow}>
              <AppText variant="bodySm" color="textMuted">Principal</AppText>
              <Amount value={detailCell.month.principal} variant="amountSm" semanticColor={false} />
            </View>
            <View style={styles.detailRow}>
              <AppText variant="bodySm" color="textMuted">Interest</AppText>
              <Amount value={detailCell.month.interest} variant="amountSm" semanticColor={false} />
            </View>
            {detailCell.month.fee > 0 ? (
              <View style={styles.detailRow}>
                <AppText variant="bodySm" color="textMuted">Fee</AppText>
                <Amount value={detailCell.month.fee} variant="amountSm" semanticColor={false} />
              </View>
            ) : null}
            <View style={styles.summaryDivider} />
            <View style={styles.detailRow}>
              <AppText variant="labelLg">This Month</AppText>
              <Amount value={detailCell.month.amount} variant="amountMd" semanticColor={false} />
            </View>
            <View style={styles.detailRow}>
              <AppText variant="bodySm" color="textMuted">Whole Loan Total</AppText>
              <Amount value={wholeLoanTotal(detailCell.debt)} variant="amountSm" semanticColor={false} />
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: theme.spacing[5] },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[4],
  },
  summary: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
    gap: theme.spacing[3],
    marginBottom: theme.spacing[4],
    ...theme.shadows.sm,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryDivider: { height: 1, backgroundColor: theme.colors.borderDefault },
  headerRow: { flexDirection: 'row' },
  row: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
  },
  nameCell: {
    justifyContent: 'center',
    paddingVertical: theme.spacing[3],
    paddingRight: theme.spacing[3],
  },
  monthCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing[3],
    gap: theme.spacing[1],
  },
  detail: { gap: theme.spacing[3] },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `grep -n "'#[0-9A-Fa-f]\{3,6\}'" src/components/debts/InstallmentGridView.tsx; grep -n "fontSize: [0-9]" src/components/debts/InstallmentGridView.tsx; grep -n "padding: [0-9]" src/components/debts/InstallmentGridView.tsx`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/debts/InstallmentGridView.tsx
git commit -m "feat: add InstallmentGridView component"
```

---

### Task 8: Wire `Grid` into the Debts screen

**Files:**
- Modify: `app/(tabs)/debts.tsx`

- [ ] **Step 1: Import the new component**

Add alongside the existing `MonthlyDebtView` import:

```ts
import { InstallmentGridView } from '../../src/components/debts/InstallmentGridView';
```

- [ ] **Step 2: Extend the view-mode list**

Current:

```ts
const VIEW_MODES = ['List', 'Monthly'] as const;
```

Change to:

```ts
const VIEW_MODES = ['List', 'Monthly', 'Grid'] as const;
```

- [ ] **Step 3: Render the Grid branch**

Current:

```tsx
      {viewMode === 'Monthly' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
        >
          <MonthlyDebtView debts={debts} accounts={accounts} />
        </ScrollView>
      ) : (
```

Change to:

```tsx
      {viewMode === 'Monthly' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
        >
          <MonthlyDebtView debts={debts} accounts={accounts} />
        </ScrollView>
      ) : viewMode === 'Grid' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
        >
          <InstallmentGridView debts={debts} accounts={accounts} />
        </ScrollView>
      ) : (
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/debts.tsx"
git commit -m "feat: wire Grid view mode into the Debts screen"
```

---

### Task 9: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run both pure-logic self-checks**

Run: `node --experimental-strip-types src/utils/installmentSchedule.check.mts`
Expected: `installmentSchedule.ts: all checks passed`

- [ ] **Step 2: Full type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Doctor check**

Run: `npx expo-doctor`
Expected: no new issues introduced by this change.

- [ ] **Step 4: On-device manual check**

Per `AGENTS.md`, this project is tested via an EAS development build, not the web target (the native `DatePicker` used by `AddDebtSheet` has no web implementation). On the dev-client device or simulator:
1. Add an installment Loan debt with a due date, monthly payment, term (e.g. 6 months), and monthly interest.
2. Open Debts → tap `Grid`. Confirm the loan appears as a row with 6 non-blank month cells starting at its due month, a Total column matching `(monthlyPayment + monthlyInterest) * 6 + fee`, and the correct "paid" styling as you record payments via the existing Add Payment flow.
3. Tap a cell — confirm the detail sheet shows principal, interest, fee (month 1 only), and the whole-loan total.
4. Navigate `‹ ›` across years — confirm the loan's cells only appear in years its schedule actually spans.

No code changes expected from this step unless it surfaces a bug — if it does, fix and repeat Steps 1-3 before re-testing on device.
