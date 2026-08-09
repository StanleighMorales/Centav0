# Installment Loan Grid View

## Problem

The Debts screen (List and Monthly views) shows what's currently outstanding
or due this month, but there's no way to see an installment loan's full
schedule at a glance: which months are already paid, what's due each month
including interest, and the total cost of the loan over its whole term.

## Goals

- A `Grid` view on the Debts screen: a spreadsheet-style table with
  installment loans as rows and months of a selected year as columns.
- Each cell shows that month's amount due (principal + flat interest),
  distinguishing paid / next-due / upcoming months.
- A trailing "Total" column per row showing the whole-loan amount to be
  paid over its full term.
- A per-month summary (Total Due / Available Funds / Expected Income /
  Still Needed) at the bottom, same coverage math as the existing Monthly
  view.
- Ability to enter, per installment loan: name (creditor, existing),
  monthly payment (existing), term in months (new), flat monthly interest
  (new), one-time fee (existing `installmentFee`).

## Non-goals

- No per-month editing of amounts — a loan's monthly payment and interest
  are constant across its term. Variable/custom schedules per month are out
  of scope.
- No new payment mechanic — the grid reads from existing `debtPaymentRepo`
  data and `Debt.outstandingBalance`; recording a payment still happens via
  the existing `AddPaymentSheet`.
- Grid only shows `isInstallment === true` Loan debts. Credit debts, Custom
  debts, and non-installment Loans have no term/schedule and are excluded.
- No cross-year row-spanning UI. A loan running Oct 2026 → Jul 2027 simply
  shows partial columns in the 2026 grid and partial columns in the 2027
  grid — no visual connector between years.
- Does not replace the existing `Monthly` view — this is a third,
  additive view mode.

## Data model changes

Two new nullable columns on `debts`, migrated the same way as the existing
`isInstallment`/`monthlyPayment`/`installmentFee` migration:

- `termMonths INTEGER` — total number of scheduled months for the
  installment plan.
- `monthlyInterest REAL` — flat interest amount added on top of
  `monthlyPayment` each scheduled month (not a rate — a fixed peso amount
  the user types in, matching how `monthlyPayment` already works).

Both fields are only meaningful when `isInstallment` is true, following the
existing pattern for `monthlyPayment`/`installmentFee`. `Debt`,
`CreateDebtInput`, and `UpdateDebtInput` in `src/domain/types.ts` gain these
two optional/nullable fields. `SqliteDebtRepository` gains them to its
create/update/row-mapping SQL, matching the existing installment fields
line-for-line.

`installmentFee` (already exists, one-time) is not repeated per month — it's
folded into month 1's cell amount and into the whole-loan total.

## Schedule computation

New pure helper, e.g. `src/utils/installmentSchedule.ts`, no new DB queries:

```ts
interface ScheduleMonth {
  index: number;        // 0-based
  dueDate: string;       // ISO
  amount: number;        // monthlyPayment + monthlyInterest (+ fee on index 0)
  principal: number;     // monthlyPayment
  interest: number;      // monthlyInterest
  status: 'paid' | 'due' | 'upcoming';
}

function buildSchedule(debt: Debt): ScheduleMonth[]
```

- Month `i` due date = `debt.dueDate` (first due date) advanced by `i`
  months, using the same day-of-month clamping approach as
  `nextDueDateIso` in `src/utils/date.ts` (Date.UTC clamps out-of-range
  days, e.g. day 31 in Feb → Feb 28/29).
- Month `i` amount = `monthlyPayment + monthlyInterest`, plus
  `installmentFee` folded into month 0 only.
- `monthsPaid = Math.min(termMonths, Math.floor((originalAmount -
  outstandingBalance) / monthlyPayment))` — "count of payments made"
  approach. This reuses the balance math the app already relies on
  (`AddPaymentSheet`'s "Monthly" pay mode reduces `outstandingBalance` by
  `monthlyPayment` per payment), so no new payment-to-month matching logic
  is needed and no new payment metadata has to be recorded.
- Status: index `< monthsPaid` → `'paid'`; index `=== monthsPaid` →
  `'due'`; index `> monthsPaid` → `'upcoming'`.
- Whole-loan total = `monthlyPayment * termMonths + monthlyInterest *
  termMonths + (installmentFee ?? 0)`.

This function is pure (`Debt` in, `ScheduleMonth[]` out) and independently
testable without touching the database.

## UI changes

**`app/(tabs)/debts.tsx`**

- `viewMode` extends to a 3-way segmented control: `List | Monthly | Grid`.
- `Grid` mode renders the new `InstallmentGridView`, passed the same
  `debts` and `accounts` arrays already loaded (no extra fetch), same as
  `Monthly` mode does today.

**`src/components/debts/InstallmentGridView.tsx`** (new)

- Local state: `selectedYear` (number, defaults to current year).
- Year navigator: `‹  2026  ›` header row, same interaction pattern as
  `MonthlyDebtView`'s month navigator, shifting `selectedYear` by ±1.
- Filters `debts` to `debtType === 'Loan' && isInstallment && termMonths`,
  builds each one's schedule via `buildSchedule`, and keeps only loans that
  have at least one scheduled month whose `dueDate` falls in
  `selectedYear`.
- Renders a horizontally-scrollable table: one row per loan (creditor +
  Jan..Dec cells + Total column), plus a bottom summary row.
- Cell rendering:
  - Combined amount, e.g. `₱3,700`, with small subtext `incl. ₱200 int`
    when `monthlyInterest > 0`.
  - Visual distinction by status: `paid` dimmed with a checkmark accent,
    `due` highlighted (accent color), `upcoming` neutral.
  - Tapping a cell opens a small detail sheet/popover: principal, interest,
    fee (if index 0), and this loan's running total-so-far vs. whole-loan
    total.
  - Months outside the loan's term (before start or after `termMonths`)
    render as empty/blank cells.
- Total column: whole-loan amount, always visible, no tap needed.
- Bottom summary row, reusing a shared coverage-math helper (factored out
  of `MonthlyDebtView` into e.g. `src/utils/debtCoverage.ts` so both views
  call the same function instead of duplicating the Total Due / Available
  Funds / Expected Income / Still Needed formula):
  - **Total Due** for the currently-navigated year's total scheduled
    amount across all shown loans (sum of all non-blank cells, not just
    one month — this is the one place Grid's summary differs from
    Monthly's single-month summary, since Grid spans 12 months at once).
  - **Available Funds** — `spendableAccounts(accounts)`, same as Monthly.
  - **Expected Income** — same per-month editable setting behavior reused
    from Monthly, but scoped for now to the current calendar month (not a
    12-way input); shown for context but the "Still Needed" figure below
    is computed per-month via the shared helper, not summed across the
    year.
  - Given the above, the bottom summary in Grid mode shows the **current
    month's** coverage (Total Due this month across grid loans / Available
    / Expected Income / Still Needed) rather than a whole-year figure —
    this keeps the "Still Needed" number meaningful (a 12-month sum of
    "still needed" isn't a number anyone budgets against) while the grid
    body itself still shows the full year's schedule visually.
- Empty state: "No installment loans scheduled in {Year}" when no rows.
- Tapping a loan's row/creditor name (not a cell) navigates to
  `/debts/${id}`, same as List and Monthly views.

**`src/components/debts/AddDebtSheet.tsx`**

- When `isInstallment` is on, add two fields alongside the existing
  `Monthly Payment` and `Installment Fee` inputs:
  - `Term (months)` — integer input, required when `isInstallment` is true
    (schedule can't be built without it).
  - `Monthly Interest` — optional amount input, defaults to 0.

## Open questions / risks

None outstanding — confirmed during brainstorming:
- Interest is a flat, user-entered peso amount per month, not a rate
  applied to a shrinking balance (simplest to build, matches how the user
  already reads their loan's official amortization table).
- "Paid" detection uses the existing outstanding-balance math
  (`monthsPaid` derived from `originalAmount - outstandingBalance`), not
  calendar-date matching against individual payment records — avoids new
  payment-to-month matching logic entirely.
- Grid is additive (a third view mode), not a replacement for the existing
  List or Monthly views.
- Whole-loan Total column is always visible (not hidden behind a tap);
  per-cell interest breakdown is behind a tap (compact grid, detail on
  demand).
