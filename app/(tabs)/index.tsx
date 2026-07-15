import React, { useState, useCallback, useEffect } from 'react';
import {
  View, ScrollView, FlatList, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FAB } from '../../src/components/ui/FAB';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { AddTransactionSheet } from '../../src/components/dashboard/AddTransactionSheet';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { TransactionRow } from '../../src/components/transactions/TransactionRow';
import { TransferSheet } from '../../src/components/transactions/TransferSheet';
import { accountRepo, categoryRepo, transactionRepo, debtPaymentRepo, getSetting, setSetting } from '../../src/repositories';
import { periodRangeIso, type Period } from '../../src/utils/date';
import { formatPHP, formatAmount } from '../../src/utils/currency';
import { theme } from '../../src/theme';
import type { Account, Transaction, AccountType } from '../../src/domain/types';

const ACCOUNT_ICON: Record<AccountType, React.ComponentProps<typeof Feather>['name']> = {
  Cash: 'dollar-sign',
  Bank: 'home',
  EWallet: 'smartphone',
  CreditCard: 'credit-card',
  Other: 'briefcase',
};

const PERIOD_KEY = 'dashboardPeriod';
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
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [monthIncome, setMonthIncome] = useState(0);
  const [monthExpense, setMonthExpense] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [transferSheetVisible, setTransferSheetVisible] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [pendingUndo, setPendingUndo] = useState<Transaction | null>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [periodOpen, setPeriodOpen] = useState(false);

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
    const allTxns = await transactionRepo.list();
    const debtPayments = await debtPaymentRepo.list();
    setAccounts(accs);
    setTotalBalance(accs.reduce((s, a) => s + a.currentBalance, 0));
    setCategoryMap(Object.fromEntries(cats.map((c) => [c.id, c.name])));
    setRecentTxns(allTxns.slice(0, 5));
    const { from, to } = periodRangeIso(period);
    const periodTxns = allTxns.filter((t) => t.date >= from.slice(0, 10) && t.date <= to.slice(0, 10));
    const periodDebtPayments = debtPayments.filter((p) => p.date >= from.slice(0, 10) && p.date <= to.slice(0, 10));
    setMonthIncome(periodTxns.filter((t) => t.type === 'Income').reduce((s, t) => s + t.amount, 0));
    setMonthExpense(
      periodTxns.filter((t) => t.type === 'Expense').reduce((s, t) => s + t.amount, 0)
      + periodDebtPayments.reduce((s, p) => s + p.amount, 0),
    );
    setLoading(false);
  }, [period]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function changePeriod(p: Period) {
    setPeriod(p);
    setPeriodOpen(false);
    await setSetting(PERIOD_KEY, p);
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
          <View style={styles.header}>
            <AppText variant="h2">Dashboard</AppText>
          </View>

          {/* Hero Balance Card - goldGlow shadow per design spec */}
          <View style={styles.heroCard}>
            <AppText variant="labelSm" color="textSecondary" style={styles.heroLabel}>
              TOTAL BALANCE
            </AppText>
            <View style={styles.heroAmount}>
              <AppText variant="amountMd" color="textSecondary" style={styles.currencySymbol}>
                {'\u20B1'}
              </AppText>
              <AppText variant="displayLg" color="textPrimary">
                {formatAmount(totalBalance)}
              </AppText>
            </View>
          </View>

          <SectionHeader
            title="Accounts"
            action={
              <Pressable
                onPress={() => router.push('/accounts')}
                accessibilityRole="button"
                accessibilityLabel="See all accounts"
              >
                <AppText variant="label" color="accentPrimary">See all</AppText>
              </Pressable>
            }
          />
          {accounts.length === 0 ? (
            <AppText variant="bodySm" color="textMuted" style={styles.emptyHint}>
              No accounts found
            </AppText>
          ) : (
            <FlatList
              data={accounts}
              keyExtractor={(a) => a.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.accountsList}
              renderItem={({ item }) => (
                <View
                  style={styles.accountCard}
                  accessibilityLabel={`${item.name}, ${item.type}, ${formatPHP(item.currentBalance)}`}
                >
                  <Feather
                    name={ACCOUNT_ICON[item.type]}
                    size={16}
                    color={theme.colors.accentPrimary}
                  />
                  <AppText variant="bodySm" numberOfLines={1} style={styles.accountName}>
                    {item.name}
                  </AppText>
                  <AppText
                    variant="amountSm"
                    color={item.currentBalance >= 0 ? 'textPrimary' : 'negative'}
                  >
                    {formatPHP(item.currentBalance)}
                  </AppText>
                </View>
              )}
            />
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

          <SectionHeader title="Recent" />
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
                categoryName={categoryMap[txn.categoryId] ?? 'Unknown'}
                onEdit={setEditTransaction}
                onUndo={setPendingUndo}
              />
            ))
          )}
        </ScrollView>
      )}

      <View style={styles.fabRow}>
        <FAB
          onPress={() => setTransferSheetVisible(true)}
          accessibilityLabel="Transfer between accounts"
          icon="repeat"
          style={styles.fabSecondary}
        />
        <FAB onPress={() => setSheetVisible(true)} accessibilityLabel="Add transaction" />
      </View>

      <AddTransactionSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSuccess={load}
      />

      <TransferSheet
        visible={transferSheetVisible}
        onClose={() => setTransferSheetVisible(false)}
        onSuccess={load}
      />

      <AddTransactionSheet
        visible={editTransaction !== null}
        initial={editTransaction}
        onClose={() => setEditTransaction(null)}
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
  },
  heroCard: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[6],
    ...theme.shadows.goldGlow,
  },
  heroLabel: {
    letterSpacing: 1.2,
    marginBottom: theme.spacing[3],
  },
  heroAmount: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing[2],
  },
  currencySymbol: {
    paddingBottom: theme.spacing[2],
  },
  accountsList: {
    paddingRight: theme.spacing[5],
    gap: theme.spacing[4],
  },
  accountCard: {
    width: 140,
    height: 80,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[4],
    justifyContent: 'space-between',
    ...theme.shadows.sm,
  },
  accountName: {
    color: theme.colors.textSecondary,
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
  fabRow: {
    position: 'absolute',
    right: theme.spacing[5],
    bottom: theme.spacing[5],
    alignItems: 'flex-end',
    gap: theme.spacing[3],
  },
  fabSecondary: {
    position: 'relative',
    right: 0,
    bottom: 0,
    width: 44,
    height: 44,
  },
});
