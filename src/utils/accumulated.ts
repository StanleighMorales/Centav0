import { roundCentavos } from './currency';
import type { Account } from '../domain/types';

/** Sentinel Select value for the virtual "Accumulated Balance" source. */
export const ACCUMULATED_ID = '__accumulated__';

/** Accounts whose balance counts toward (and can be drawn from) the accumulated balance. */
export function spendableAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => !a.allowsOverdraft && a.currentBalance > 0);
}

export function accumulatedTotal(accounts: Account[]): number {
  return roundCentavos(spendableAccounts(accounts).reduce((sum, a) => sum + a.currentBalance, 0));
}

export interface AccountPortion { account: Account; amount: number; }

/**
 * Split `amount` across spendable accounts, draining the largest balance first.
 * Returns null if the accumulated balance cannot cover the amount.
 */
export function splitAcrossAccounts(accounts: Account[], amount: number): AccountPortion[] | null {
  let remaining = roundCentavos(amount);
  if (remaining > accumulatedTotal(accounts)) return null;
  const portions: AccountPortion[] = [];
  const sorted = [...spendableAccounts(accounts)].sort((a, b) => b.currentBalance - a.currentBalance);
  for (const account of sorted) {
    if (remaining <= 0) break;
    const take = roundCentavos(Math.min(account.currentBalance, remaining));
    portions.push({ account, amount: take });
    remaining = roundCentavos(remaining - take);
  }
  return remaining > 0 ? null : portions;
}
