# Credit lines: monthly statements, installment purchases, pay in full

## Goal
Credit (Atome, credit cards) works like a real credit line: buy now, pay monthly statements, or pay everything at once. Loans and Custom debts are unchanged.

## Decisions
- A purchase lands on the next statement after its date. Purchases on the bill day go on that day's statement by default; a per-credit-line setting moves them to the next one.
- A purchase can be split over N months: one Nth per statement, and the last month takes the leftover centavos. No fees or interest for now.
- The **earlier balance** is what's owed beyond recorded purchases (e.g. a transfer out of the card, a balance edit). It is split over "months left", starting at a chosen first bill (default: the next bill date). If it comes out negative (e.g. a transfer into the card), it counts as an extra payment.
- Payments fill the oldest statement first, so paying early counts toward the next bill.
- Pay: **Due now** (everything billed and unpaid), **Full balance**, or **Custom**, from a non-credit account.
- Per-charge settling ("Pay All Charges", Pay on a charge) is removed. One way to pay.

## Statements (`src/utils/creditStatements.ts`, pure)
`buildStatements({ billDay, dueDay, billDayNext, charges, payments, owed, earlier, today })` returns every statement, oldest first: `{ billDate, dueDate, amount, paid, remaining, status }`.
- Bill date for a purchase on Manila date `d` with bill day `B`: this month if `d < B`, or `d == B` and not `billDayNext`; otherwise next month. Days clamp to the month's length.
- Due date: same month as the bill if `dueDay > billDay`, else the next month.
- `earlier.amount = owed − (Σ charges − Σ payments)`.
- Status, in order: `paid` (remaining 0) · `upcoming` (not billed yet) · `overdue` (past the due day) · `dueSoon` (due within 7 days) · `due`.
- Colours, defined once: paid → positive, overdue → negative, dueSoon → warning, due → textPrimary, upcoming → textMuted. Total owed and available stay neutral; nothing is red unless overdue.
- Self-check `creditStatements.check.mts`: the 7th / 8th / 9th example (bill 8, due 15), the bill-day setting, 3-month split with centavo remainder, earlier balance months, early payment, transfer-in credit, due 25 → 5 rolling to the next month, status order.

## Data (migration `019_credit_statements`)
- `transactions.installmentMonths INTEGER` (null = 1).
- `accounts.billDayNextStatement INTEGER NOT NULL DEFAULT 0`, `accounts.earlierBalanceMonths INTEGER`, `accounts.earlierBalanceFirstBill TEXT`.
- Account and transaction types, mappers, create and update carry the new fields.

## UI
- **Add Transaction:** with a credit account and Expense, "Pay over" chips 1 / 3 / 6 / 12 months.
- **Add credit line:** Ledger's + on the Credit tab opens the account sheet limited to credit types, titled "Add Credit Line". Credit account sheets (add and edit) get the bill-day setting.
- **Credit debt screen:**
  - Summary: owed, limit, available.
  - "This statement" card: amount, due date, coloured status.
  - **Pay** button.
  - **Repayments:** every statement (bill date, due date, amount, paid, coloured status).
  - Earlier balance row with a Change link (months left, first bill).
  - Charges with "N months · ₱X/mo", Edit and Delete.
  - Payment history.
- **Ledger row (credit):** coloured statement line: "₱X overdue", "₱X due 15 Nov", "✓ Paid for 15 Nov" or "Next bill 8 Dec · ₱X". Owed and available stay neutral.
- **Monthly view:** credit lines contribute each statement's remaining amount in its due month, instead of the whole balance.
- **Voice:** a credit payment opens Pay on Due now; a spoken amount sets Custom.

## Removed
`debtPaymentRepo.settle`, settle mode in `AddPaymentSheet`, charge Pay buttons, and `paidForDue` (replaced by statements). Old `settledAt` values stay in the data; they're unused.

## Out of scope
Fees and interest on installments, the Grid view (loans only), changing what Loans and Custom debts do, and old hand-added Credit entries (they keep working as before).
