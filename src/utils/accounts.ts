import type React from 'react';
import type { Feather } from '@expo/vector-icons';
import type { Account } from '../domain/types';

/** Spendable cash — the only accounts that count toward Total Balance. */
export const isSpending = (a: Account) => !a.allowsOverdraft && !a.isSavings;
/** Money set aside. Real balance, but tallied separately from Total Balance. */
export const isSavings = (a: Account) => !a.allowsOverdraft && a.isSavings;
/** Credit cards and other overdraft-capable accounts. */
export const isCredit = (a: Account) => a.allowsOverdraft;

export function accountIcon(account: Account): React.ComponentProps<typeof Feather>['name'] {
  if (isCredit(account)) return 'credit-card';
  return account.isSavings ? 'pocket' : 'briefcase';
}

export const sumBalance = (accounts: Account[]) =>
  accounts.reduce((s, a) => s + a.currentBalance, 0);

export type AccountGroup = { label: string; accounts: Account[] };

/** The three balance buckets, empty ones dropped. Order is display order. */
export function groupAccounts(accounts: Account[]): AccountGroup[] {
  return [
    { label: 'Balance', accounts: accounts.filter(isSpending) },
    { label: 'Savings', accounts: accounts.filter(isSavings) },
    { label: 'Credit', accounts: accounts.filter(isCredit) },
  ].filter((g) => g.accounts.length > 0);
}
