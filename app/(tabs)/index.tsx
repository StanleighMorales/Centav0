import React, { useState, useCallback, useEffect } from 'react';
import {
  View, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { Amount } from '../../src/components/ui/Amount';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FAB } from '../../src/components/ui/FAB';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { AddTransactionSheet } from '../../src/components/dashboard/AddTransactionSheet';
import { AddAccountSheet } from '../../src/components/accounts/AddAccountSheet';
import { TransferSheet } from '../../src/components/transactions/TransferSheet';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { TransactionRow } from '../../src/components/transactions/TransactionRow';
import { AccountCarousel } from '../../src/components/dashboard/AccountCarousel';
import { accountRepo, categoryRepo, transactionRepo, debtPaymentRepo, getSetting, setSetting } from '../../src/repositories';
import { periodRangeIso, type Period } from '../../src/utils/date';
import { formatPHP, formatAmount, HIDDEN_AMOUNT } from '../../src/utils/currency';
import { groupAccounts, isCredit, isSavings, isSpending, sumBalance } from '../../src/utils/accounts';
import { theme } from '../../src/theme';
import type { Account, Transaction } from '../../src/domain/types';

function parseOrder(raw: string | null): string[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Saved order first; accounts the saved order doesn't know about keep their creation order at the end. */
function sortByOrder(accounts: Account[], order: string[]): Account[] {
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...accounts].sort((a, b) => rank(a.id) - rank(b.id));
}

function EyeToggle({ hidden, onPress, label }: { hidden: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={theme.spacing[4]}
      accessibilityRole="button"
      accessibilityState={{ checked: hidden }}
      accessibilityLabel={`${hidden ? 'Show' : 'Hide'} ${label}`}
    >
      <Feather name={hidden ? 'eye-off' : 'eye'} size={18} color={theme.colors.textSecondary} />
    </Pressable>
  );
}

const PERIOD_KEY = 'dashboardPeriod';
const HIDE_TOTAL_KEY = 'hideTotalBalance';
const HIDE_CREDIT_KEY = 'hideCreditBalance';
const HIDE_SAVINGS_KEY = 'hideSavingsBalance';
const ORDER_KEY = 'accountOrder';
const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
];
const periodLabel = (p: Period) => PERIOD_OPTIONS.find((o) => o.value === p)?.label ?? 'This Month';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [totalBalance, setTotalBalance] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const ordered = sortByOrder(accounts, order);
  const creditAccounts = ordered.filter(isCredit);
  const savingsAccounts = ordered.filter(isSavings);
  const totalCredit = sumBalance(creditAccounts);
  const totalSavings = sumBalance(savingsAccounts);
  const [allTxns, setAllTxns] = useState<Transaction[]>([]);
  const [recentFilter, setRecentFilter] = useState<'day' | 'week' | 'all'>('all');
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [monthIncome, setMonthIncome] = useState(0);
  const [monthExpense, setMonthExpense] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [addAccountVisible, setAddAccountVisible] = useState(false);
  const [transferSheetVisible, setTransferSheetVisible] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [pendingUndo, setPendingUndo] = useState<Transaction | null>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [hideTotal, setHideTotal] = useState(false);
  const [hideCredit, setHideCredit] = useState(false);
  const [hideSavings, setHideSavings] = useState(false);

  // Restore the persisted period once on mount so it survives app restarts.
  useEffect(() => {
    getSetting(PERIOD_KEY).then((v) => {
      if (v === 'day' || v === 'week' || v === 'month' || v === 'year') setPeriod(v);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    // ponytail: sequential to avoid expo-sqlite concurrent promise queue bug
    const accs = await accountRepo.list();
    const cats = await categoryRepo.list();
    const txns = await transactionRepo.list();
    const debtPayments = await debtPaymentRepo.list();
    setAccounts(accs);
    setOrder(parseOrder(await getSetting(ORDER_KEY)));
    setTotalBalance(sumBalance(accs.filter(isSpending)));
    setCategoryMap(Object.fromEntries(cats.map((c) => [c.id, c.name])));
    setAllTxns(txns);
    const { from, to } = periodRangeIso(period);
    const periodTxns = txns.filter((t) => t.date >= from.slice(0, 10) && t.date <= to.slice(0, 10));
    const periodDebtPayments = debtPayments.filter((p) => p.date >= from.slice(0, 10) && p.date <= to.slice(0, 10));
    setMonthIncome(periodTxns.filter((t) => t.type === 'Income').reduce((s, t) => s + t.amount, 0));
    setMonthExpense(
      periodTxns.filter((t) => t.type === 'Expense').reduce((s, t) => s + t.amount, 0)
      + periodDebtPayments.reduce((s, p) => s + p.amount, 0),
    );
    // ponytail: read inside load() so the loader covers it — no flash of a balance meant to stay hidden
    setHideTotal((await getSetting(HIDE_TOTAL_KEY)) === '1');
    setHideCredit((await getSetting(HIDE_CREDIT_KEY)) === '1');
    setHideSavings((await getSetting(HIDE_SAVINGS_KEY)) === '1');
    setLoading(false);
  }, [period]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const recentTxns = (
    recentFilter === 'all' ? allTxns : allTxns.filter((t) => {
      const { from, to } = periodRangeIso(recentFilter);
      return t.date >= from && t.date <= to;
    })
  ).slice(0, 5);

  async function changePeriod(p: Period) {
    setPeriod(p);
    setPeriodOpen(false);
    await setSetting(PERIOD_KEY, p);
  }

  async function toggleHidden(key: string, next: boolean, set: (v: boolean) => void) {
    set(next);
    await setSetting(key, next ? '1' : '0');
  }

  // `next` is one group's ids reordered — splice them back into the full order, leaving other groups put.
  async function handleReorder(next: string[]) {
    const group = new Set(next);
    let i = 0;
    const merged = ordered.map((a) => (group.has(a.id) ? next[i++] : a.id));
    setOrder(merged);
    await setSetting(ORDER_KEY, JSON.stringify(merged));
  }

  async function handleUndo() {
    if (!pendingUndo) return;
    await transactionRepo.softDelete(pendingUndo.id);
    setPendingUndo(null);
    load();
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={theme.colors.accentPrimary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 80 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader title="Dashboard" />

          {/* Hero Balance Card */}
          <View style={styles.heroCard}>
            <View style={styles.labelRow}>
              <AppText variant="labelSm" color="textSecondary" style={styles.heroLabel}>
                TOTAL BALANCE
              </AppText>
              <EyeToggle
                hidden={hideTotal}
                label="total balance"
                onPress={() => toggleHidden(HIDE_TOTAL_KEY, !hideTotal, setHideTotal)}
              />
            </View>
            <View style={styles.heroAmount}>
              <AppText variant="amountMd" color="positive" style={styles.currencySymbol}>
                {'\u20B1'}
              </AppText>
              <AppText variant="displayLg" color="positive">
                {hideTotal ? HIDDEN_AMOUNT : formatAmount(totalBalance)}
              </AppText>
            </View>
          </View>

          {savingsAccounts.length > 0 && (
            <View style={styles.savingsCard}>
              <View style={styles.labelRow}>
                <AppText variant="labelSm" color="textMuted" style={styles.heroLabel}>
                  TOTAL SAVINGS
                </AppText>
                <EyeToggle
                  hidden={hideSavings}
                  label="savings balance"
                  onPress={() => toggleHidden(HIDE_SAVINGS_KEY, !hideSavings, setHideSavings)}
                />
              </View>
              <Amount value={totalSavings} variant="amountLg" color="info" semanticColor={false} hidden={hideSavings} />
              {savingsAccounts.map((a) => (
                <View key={a.id} style={styles.creditRow}>
                  <AppText variant="bodySm" color="textMuted">{a.name}</AppText>
                  <Amount value={a.currentBalance} variant="amountSm" color="info" semanticColor={false} hidden={hideSavings} />
                </View>
              ))}
            </View>
          )}

          {creditAccounts.length > 0 && (
            <View style={styles.creditCard}>
              <View style={styles.labelRow}>
                <AppText variant="labelSm" color="textMuted" style={styles.heroLabel}>
                  TOTAL CREDIT
                </AppText>
                <EyeToggle
                  hidden={hideCredit}
                  label="credit balance"
                  onPress={() => toggleHidden(HIDE_CREDIT_KEY, !hideCredit, setHideCredit)}
                />
              </View>
              <Amount value={totalCredit} variant="amountLg" color="accentPrimary" semanticColor={false} hidden={hideCredit} />
              {creditAccounts.map((a) => (
                <View key={a.id} style={styles.creditRow}>
                  <AppText variant="bodySm" color="textMuted">{a.name}</AppText>
                  <Amount value={a.currentBalance} variant="amountSm" color="accentPrimary" semanticColor={false} hidden={hideCredit} />
                </View>
              ))}
            </View>
          )}

          <SectionHeader
            title="Accounts"
            action={
              <View style={styles.accountsActions}>
                <Pressable
                  onPress={() => setTransferSheetVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Transfer between accounts"
                  style={styles.transferBtn}
                >
                  <Feather name="repeat" size={14} color={theme.colors.accentPrimary} />
                </Pressable>
                <Pressable
                  onPress={() => setAddAccountVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Add account"
                  style={styles.addAccountBtn}
                >
                  <Feather name="plus" size={14} color={theme.colors.bgPrimary} />
                </Pressable>
              </View>
            }
          />
          {accounts.length === 0 ? (
            <AppText variant="bodySm" color="textMuted" style={styles.emptyHint}>
              No accounts found
            </AppText>
          ) : (
            groupAccounts(ordered).map((group) => (
              <View key={group.label} style={styles.accountGroup}>
                <AppText variant="labelSm" color="textMuted" style={styles.groupLabel}>
                  {group.label.toUpperCase()}
                </AppText>
                <AccountCarousel
                  accounts={group.accounts}
                  onPress={() => router.push('/accounts')}
                  onReorder={handleReorder}
                />
              </View>
            ))
          )}

          <Pressable
            onPress={() => setPeriodOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Change period, currently ${periodLabel(period)}`}
            style={styles.periodHeader}
          >
            <AppText variant="label" color="textMuted">{periodLabel(period).toUpperCase()}</AppText>
            <Feather name="chevron-down" size={16} color={theme.colors.textMuted} />
          </Pressable>
          <View style={styles.monthCard}>
            <View style={styles.monthCol}>
              <AppText variant="labelLg" color="positive">{'\u25B2'} Income</AppText>
              <AppText variant="amountMd" color="positive">{formatPHP(monthIncome)}</AppText>
            </View>
            <View style={styles.monthDivider} />
            <View style={styles.monthCol}>
              <AppText variant="labelLg" color="negative">{'\u25BC'} Expense</AppText>
              <AppText variant="amountMd" color="negative">{formatPHP(monthExpense)}</AppText>
            </View>
          </View>

          <View style={styles.recentHeader}>
            <AppText variant="h3">Recent</AppText>
            <View style={styles.recentChips}>
              {(['day', 'week', 'all'] as const).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setRecentFilter(f)}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter recent transactions by ${f}`}
                  accessibilityState={{ selected: recentFilter === f }}
                  style={[styles.recentChip, recentFilter === f && styles.recentChipActive]}
                >
                  <AppText variant="labelSm" color={recentFilter === f ? 'accentPrimary' : 'textSecondary'}>
                    {f === 'day' ? 'Today' : f === 'week' ? 'This Week' : 'All'}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
          {recentTxns.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="No transactions yet"
              subtitle="Tap + to record your first transaction"
            />
          ) : (
            recentTxns.map((txn) => (
              <TransactionRow
                key={txn.id}
                transaction={txn}
                categoryName={txn.type === 'Transfer' ? (accountMap[txn.accountId] ?? 'Unknown') : (categoryMap[txn.categoryId ?? ''] ?? 'Unknown')}
                toAccountName={txn.toAccountId ? accountMap[txn.toAccountId] : undefined}
                onEdit={setEditTransaction}
                onUndo={setPendingUndo}
              />
            ))
          )}
        </ScrollView>
      )}

      <FAB onPress={() => setSheetVisible(true)} accessibilityLabel="Add transaction" />

      <AddTransactionSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSuccess={load}
      />

      <AddTransactionSheet
        visible={editTransaction !== null}
        initial={editTransaction}
        onClose={() => setEditTransaction(null)}
        onSuccess={load}
      />

      <AddAccountSheet
        visible={addAccountVisible}
        onClose={() => setAddAccountVisible(false)}
        onSuccess={load}
      />

      <TransferSheet
        visible={transferSheetVisible}
        onClose={() => setTransferSheetVisible(false)}
        onSuccess={load}
      />

      <ConfirmDialog
        visible={pendingUndo !== null}
        title="Undo Transaction"
        message={
          pendingUndo?.type === 'Expense'
            ? `Undo this expense and return ${formatPHP(pendingUndo.amount)} to the account?`
            : `Undo this income and remove ${formatPHP(pendingUndo?.amount ?? 0)} from the account?`
        }
        confirmLabel="Undo"
        onConfirm={handleUndo}
        onCancel={() => setPendingUndo(null)}
      />

      <BottomSheet visible={periodOpen} onClose={() => setPeriodOpen(false)} title="Period">
        {PERIOD_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => changePeriod(opt.value)}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: opt.value === period }}
            style={styles.periodOption}
          >
            <AppText variant="body" color={opt.value === period ? 'accentPrimary' : 'textPrimary'}>
              {opt.label}
            </AppText>
            {opt.value === period ? (
              <Feather name="check" size={18} color={theme.colors.accentPrimary} />
            ) : null}
          </Pressable>
        ))}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[4],
  },
  header: {
    marginTop: theme.spacing[6],
    marginBottom: theme.spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountsActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
  },
  transferBtn: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAccountBtn: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[6],
    ...theme.shadows.md,
  },
  heroLabel: {
    letterSpacing: 1.2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[3],
  },
  creditCard: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
    marginTop: theme.spacing[4],
    gap: theme.spacing[2],
    ...theme.shadows.goldGlow,
  },
  savingsCard: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
    marginTop: theme.spacing[4],
    gap: theme.spacing[2],
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    ...theme.shadows.sm,
  },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: theme.spacing[2],
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
  },
  heroAmount: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing[2],
  },
  currencySymbol: {
    paddingBottom: theme.spacing[2],
  },
  accountGroup: {
    gap: theme.spacing[3],
  },
  groupLabel: {
    letterSpacing: 1.2,
  },
  emptyHint: {
    marginVertical: theme.spacing[4],
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  periodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  monthCard: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
    flexDirection: 'row',
    ...theme.shadows.sm,
  },
  monthCol: {
    flex: 1,
    gap: theme.spacing[2],
  },
  monthDivider: {
    width: 1,
    backgroundColor: theme.colors.borderDefault,
    marginHorizontal: theme.spacing[4],
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing[2],
  },
  recentChips: { flexDirection: 'row', gap: theme.spacing[2] },
  recentChip: {
    paddingVertical: theme.spacing[1],
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  recentChipActive: {
    borderColor: theme.colors.accentBorder,
    backgroundColor: theme.colors.accentSubtle,
  },
});
