// Flat-rate loan terms (lender quotes % of the amount borrowed, per month). Pure, so the self-check runs in plain Node.
const round2 = (n: number) => Math.round(n * 100) / 100;

export type LoanTermsInput = {
  amount: number;
  months: number;
  interestPct: number;
  feePct: number;
  /** Charged once, with the first payment. */
  oneTimeFee: number;
  paidMonths: number;
  /** The lender's exact monthly payment; 0 = work it out from the rates. */
  paymentOverride: number;
};

export function flatLoanTerms(i: LoanTermsInput) {
  // Interest and the monthly fee are both a flat % of the amount borrowed, every month.
  const extra = round2((i.amount * (i.interestPct + i.feePct)) / 100);
  const monthlyPayment = i.paymentOverride > 0 ? i.paymentOverride : round2(i.amount / i.months + extra);
  // ponytail: the lender's own total can differ from this by a few centavos of rounding.
  const total = i.paymentOverride > 0
    ? round2(monthlyPayment * i.months + i.oneTimeFee)
    : round2(i.amount + extra * i.months + i.oneTimeFee);
  const paid = i.paidMonths > 0 ? round2(monthlyPayment * i.paidMonths + i.oneTimeFee) : 0;
  return {
    monthlyPayment,
    /** The principal share of a payment (what `Debt.monthlyPayment` stores); `extra` is `Debt.monthlyInterest`. */
    principalPart: round2(monthlyPayment - extra),
    extra,
    total,
    interestAndFees: round2(total - i.amount),
    remaining: round2(total - paid),
  };
}

/** One payment per month already paid, on the given due dates; the one-time fee rides on the first. */
export function pastPayments(dueDates: string[], monthlyPayment: number, oneTimeFee: number) {
  return dueDates.map((date, k) => ({ date, amount: round2(monthlyPayment + (k === 0 ? oneTimeFee : 0)) }));
}
