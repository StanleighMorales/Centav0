// Pure investment math. ROI % is derived, never stored, so it can't disagree with the amounts.
type Upd = { date: string; amount: number; stakePct: number | null };
type Inv = { amountPaid: number; stakePct: number | null; expectedReturnPct: number | null };

export interface InvestmentStats {
  returned: number;
  /** null when nothing was paid (no cost to divide by). */
  roiPct: number | null;
  net: number;
  stakePct: number | null;
  /** 0..1 progress: toward paid × target when a target is set, else payback toward amount paid. */
  progress: number;
}

const byDate = (a: Upd, b: Upd) => a.date.localeCompare(b.date);

export function investmentStats(inv: Inv, updates: Upd[]): InvestmentStats {
  const sorted = [...updates].sort(byDate);
  const returned = sorted.reduce((s, u) => s + u.amount, 0);
  const latestStake = [...sorted].reverse().find((u) => u.stakePct != null)?.stakePct ?? inv.stakePct;
  const goal = inv.expectedReturnPct && inv.expectedReturnPct > 0
    ? (inv.amountPaid * inv.expectedReturnPct) / 100
    : inv.amountPaid;
  return {
    returned,
    roiPct: inv.amountPaid > 0 ? (returned / inv.amountPaid) * 100 : null,
    net: returned - inv.amountPaid,
    stakePct: latestStake ?? null,
    progress: goal > 0 ? Math.min(1, returned / goal) : 0,
  };
}

/** Peso amount for an ROI % entered against the amount paid. */
export const amountFromRoi = (paid: number, pct: number) => Math.round(paid * pct) / 100;

/** ROI % of a single peso amount against the amount paid, null when nothing was paid. */
export const roiOf = (paid: number, amount: number) => (paid > 0 ? (amount / paid) * 100 : null);

/** Newest first, each row carrying the cumulative ROI % up to and including it. */
export function timeline<T extends Upd>(paid: number, updates: T[]): (T & { runningRoiPct: number | null })[] {
  let run = 0;
  return [...updates].sort(byDate).map((u) => {
    run += u.amount;
    return { ...u, runningRoiPct: roiOf(paid, run) };
  }).reverse();
}

export const formatPct = (n: number) => `${Math.round(n * 10) / 10}%`;
