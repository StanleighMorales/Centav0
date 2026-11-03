# Flat-rate loan input

## Problem

The loan form only takes a monthly payment, a flat monthly interest amount and a one-time fee. A lender like the one
in the screenshot (₱17,500, 12 months, 3.95%/mo interest, 0.20%/mo loan protection) states percentages, and the user
may add a loan that is already partly paid. Also, a loan's balance starts at the amount borrowed, but every payment
includes interest, so the balance reaches zero before the loan is repaid.

## Design

### Form (Loan, installment plan on)

Inputs: amount borrowed, term (months), first due date, monthly interest %, monthly protection/fee %, one-time fee
(optional), months already paid (default 0, at most the term).

A live preview shows monthly payment, total repayable, interest plus fees, and remaining.
Example: ₱17,500 / 12 months / 3.95% / 0.20% gives ₱2,184.58 a month, ₱26,215 total, and about ₱21,846 left after 2 paid months.

The monthly payment is editable. Typing the lender's exact figure replaces the computed one and the total follows it.

### Maths (flat rate)

- interest per month = amount × interest %
- fee per month = amount × fee %
- principal per month = amount ÷ term
- monthly payment = principal + interest + fee
- total repayable = monthly payment × term + one-time fee

### Storage (no schema change)

- `monthlyPayment` = principal per month; `monthlyInterest` = interest + fee per month; `installmentFee` = one-time fee.
  When the user overrides the payment, `monthlyPayment` = override − `monthlyInterest`.
- `originalAmount` stays the amount borrowed. `outstandingBalance` starts at total repayable minus the paid months.
- Months already paid become `debt_payments` rows (one per month, dated on that month's due date) with no account,
  so no balance changes. The payment list labels them "Paid before tracking".
- Disbursement to an account is unchanged.

### Schedule

`buildSchedule` derives paid months from `(wholeLoanTotal − outstandingBalance) ÷ (monthlyPayment + monthlyInterest)`
instead of `originalAmount − outstandingBalance`, so the grid and monthly views show the right paid/due/upcoming rows.

### Out of scope

Existing loans with interest keep their stored balance; only new loans get the new behavior.
Declining-balance (amortized) interest is not supported.

## Testing

A self-check (`loanTerms.check.mts`) for the maths using the screenshot loan (payment ₱2,184.58, total ₱26,215, interest
₱8,295, fees ₱420, remaining after 2 paid months), the payment override, and zero rates. The schedule check gets a case
for paid-month derivation with interest.
