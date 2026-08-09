# Monthly Debt Table + Coverage Estimate

## Problem

The Debts screen lists debts flat (filtered by type/status) with no sense of
"what do I owe by when this month." There's no view that groups obligations
by due date, subtotals them, and checks whether this month's due amounts are
covered by current funds plus money the user expects to receive.

## Goals

- A `Monthly` view on the Debts screen: unpaid debts due in a selected month,
  grouped by exact due date, each group subtotaled, with a month total.
- A per-month "Expected Income" figure the user can type in (e.g. an
  allowance or gift they're confident about receiving).
- A requirement summary: Total Due, Available Funds, Expected Income, Still
  Needed = `max(0, TotalDue - AvailableFunds - ExpectedIncome)`.

## Non-goals

- No new "pay via credit card" mechanic — paying any debt with a linked
  credit card as the funding account already rolls that amount onto the
  card's own debt and its next due date, via the existing
  `syncLinkedCreditDebt`. Nothing to change there.
- No multi-entry income list (just one editable number per month).
- No new database tables — reuses `debts` and the existing `settings`
  key-value store.
- Debts with no `dueDate` (e.g. some Custom debts) never appear in the
  Monthly view — they don't belong to a month.
- Paid debts never appear in the Monthly view — it answers "what do I still
  need to cover," not a payment ledger.

## Data model changes

None. `Debt.dueDate` already drives grouping. Expected Income persists as a
`settings` row keyed `expectedIncome:{YYYY-MM}` (e.g.
`expectedIncome:2026-08`), read/written via the existing `getSetting` /
`setSetting` helpers in `src/repositories/settings.ts`.

## UI changes

**`app/(tabs)/debts.tsx`**

- New segmented control at the top: `List | Monthly` (state `viewMode`,
  defaults to `List`). Existing type/status tabs and FlatList render only in
  `List` mode, unchanged.
- `Monthly` mode renders a new `MonthlyDebtView` component, passed the full
  `debts` and `accounts` arrays already loaded by the screen (no extra
  fetch).

**`src/components/debts/MonthlyDebtView.tsx`** (new)

- Local state: `selectedMonth` (Date, defaults to current month),
  `expectedIncome` (number, loaded from settings on month change).
- Month navigator: `‹  August 2026  ›` header row (prev/next arrows shift
  `selectedMonth` by one month, using the same month-math pattern as
  `monthRangeIso` in `src/utils/date.ts`).
- Filters `debts` to `status !== 'Paid' && dueDate` falls within
  `selectedMonth`, groups by exact `dueDate`, sorts groups ascending by date.
  Each group renders its rows (creditor + amount) and a subtotal line; a
  month total sums all groups.
- Summary card above the groups, same visual style as the existing
  List-mode summary card:
  - **Total Due** — the month total above.
  - **Available Funds** — `spendableAccounts(accounts)` balances summed
    (reuses `src/utils/accumulated.ts`, same helper the List view already
    uses).
  - **Expected Income** — editable inline (tap to open a small numeric input,
    same interaction as other inline-editable amounts in the app). On change,
    persists via `setSetting('expectedIncome:{YYYY-MM}', String(value))`.
  - **Still Needed** — `max(0, TotalDue - AvailableFunds - ExpectedIncome)`,
    colored positive (covered) / negative (short) via the existing
    `Amount`/`AppText` color conventions.
- Empty state: "No debts due in {Month}" when no groups.
- Tapping a debt row navigates to `/debts/${id}`, same as the List view.

## Open questions / risks

None outstanding — confirmed during brainstorming:
- Monthly view is additive (a toggle), not a replacement of the existing
  list.
- Credit-card-funded payments already roll balances to next month; verified
  in `SqliteDebtPaymentRepository.create` + `creditSync.ts`, no changes
  needed.
- Expected Income is a single number per month, stored in the generic
  `settings` table — no migration required.
- "Estimated monthly requirement" and "realistic estimate to follow" are the
  same number (Still Needed) — no second budget concept.
