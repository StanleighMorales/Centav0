import React, { useState, useCallback, useEffect } from 'react';
import {
  View, SectionList, Pressable, ActivityIndicator, } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../src/components/ui/AppText';
import { Chip } from '../../src/components/ui/Chip';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { AddTransactionSheet } from '../../src/components/dashboard/AddTransactionSheet';
import { TransactionRow } from '../../src/components/transactions/TransactionRow';
import { TransactionDetailSheet } from '../../src/components/transactions/TransactionDetailSheet';
import { transactionRepo, categoryRepo, accountRepo } from '../../src/repositories';
import { displayDate, periodRangeIso, type Period } from '../../src/utils/date';
import { formatPHP } from '../../src/utils/currency';
import { theme, makeStyles, useTheme } from '../../src/theme';
import { TAB_BAR_SPACE } from '../../src/components/nav/FloatingTabBar';
import { onDataChanged } from '../../src/utils/dataEvents';
import type { Transaction, TransactionType } from '../../src/domain/types';

type Filter = 'All' | TransactionType;
const FILTERS: Filter[] = ['All', 'Expense', 'Income'];

type DateFilter = Period | 'all';
const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All' },
];

function groupByDate(txns: Transaction[]): { title: string; data: Transaction[] }[] {
  const map = new Map<string, Transaction[]>();
  for (const t of txns) {
    const key = displayDate(t.date);
    const bucket = map.get(key);
    if (bucket) bucket.push(t);
    else map.set(key, [t]);
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

export default function TransactionsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('All');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [sections, setSections] = useState<{ title: string; data: Transaction[] }[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [accountMap, setAccountMap] = useState<Record<string, string>>({});
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [pendingUndo, setPendingUndo] = useState<Transaction | null>(null);
  const [undoneNotice, setUndoneNotice] = useState(false);

  const load = useCallback(async (activeFilter: Filter, activeDateFilter: DateFilter) => {
    setLoading(true);
    const range = activeDateFilter === 'all' ? undefined : periodRangeIso(activeDateFilter);
    const txns = await transactionRepo.list({
      ...(activeFilter !== 'All' ? { type: activeFilter } : {}),
      ...(range ?? {}),
    });
    const cats = await categoryRepo.list();
    setCategoryMap(Object.fromEntries(cats.map((c) => [c.id, c.name])));
    const accs = await accountRepo.list();
    const deletedAccs = await accountRepo.listDeleted();
    setAccountMap(Object.fromEntries([
      ...accs.map((a) => [a.id, a.name]),
      ...deletedAccs.map((a) => [a.id, `${a.name} (Deleted ${displayDate(a.deletedAt!)})`]),
    ]));
    setSections(groupByDate(txns));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(filter, dateFilter); }, [filter, dateFilter, load]));
  useEffect(() => onDataChanged(() => { load(filter, dateFilter); }), [filter, dateFilter, load]);

  const totals = sections.reduce(
    (acc, sec) => {
      for (const t of sec.data) {
        if (t.type === 'Income') acc.income += t.amount;
        else if (t.type === 'Expense') acc.expense += t.amount;
      }
      acc.net = acc.income - acc.expense;
      return acc;
    },
    { income: 0, expense: 0, net: 0 },
  );

  const handleFilter = (f: Filter) => {
    setFilter(f);
    load(f, dateFilter);
  };

  const handleDateFilter = (f: DateFilter) => {
    setDateFilter(f);
    load(filter, f);
  };

  async function handleUndo() {
    if (!pendingUndo) return;
    await transactionRepo.softDelete(pendingUndo.id);
    setPendingUndo(null);
    setUndoneNotice(true);
    load(filter, dateFilter);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Activity" />

      <View style={styles.chips}>
        {FILTERS.map((f) => (
          <Chip key={f} label={f} selected={filter === f} onPress={() => handleFilter(f)} accessibilityLabel={`Filter by ${f}`} />
        ))}
      </View>

      <View style={styles.chips}>
        {DATE_FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} selected={dateFilter === f.key} onPress={() => handleDateFilter(f.key)} accessibilityLabel={`Filter by ${f.label}`} />
        ))}
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryCol}>
          <AppText variant="labelSm" color="textMuted">NET</AppText>
          <AppText variant="amountLg">{totals.net < 0 ? '-' : '+'}{formatPHP(Math.abs(totals.net))}</AppText>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCol}>
            <AppText variant="labelSm" color="textMuted">IN</AppText>
            <AppText variant="amountMd" color="positive">+{formatPHP(totals.income)}</AppText>
          </View>
          <View style={styles.summaryCol}>
            <AppText variant="labelSm" color="textMuted">OUT</AppText>
            <AppText variant="amountMd" color="negative">-{formatPHP(totals.expense)}</AppText>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accentPrimary} size="large" />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: TAB_BAR_SPACE + insets.bottom },
          ]}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <AppText variant="label" color="textMuted" style={styles.sectionHeader}>
              {section.title.toUpperCase()}
            </AppText>
          )}
          renderItem={({ item }) => (
            <TransactionRow
              transaction={item}
              categoryName={item.type === 'Transfer' ? (accountMap[item.accountId] ?? 'Unknown') : (categoryMap[item.categoryId ?? ''] ?? 'Unknown')}
              toAccountName={item.toAccountId ? accountMap[item.toAccountId] : undefined}
              subtitle={item.note ?? undefined}
              onEdit={setEditTransaction}
              onUndo={setPendingUndo}
              onOpenDetail={setDetailTransaction}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="list"
              title="No transactions"
              subtitle={
                filter === 'All'
                  ? 'Tap + to add one'
                  : `No ${filter.toLowerCase()} transactions found`
              }
            />
          }
        />
      )}

      <TransactionDetailSheet
        transaction={detailTransaction}
        categoryName={detailTransaction && detailTransaction.type !== 'Transfer' ? (categoryMap[detailTransaction.categoryId ?? ''] ?? 'Unknown') : ''}
        accountName={detailTransaction ? (accountMap[detailTransaction.accountId] ?? 'Unknown') : ''}
        toAccountName={detailTransaction?.toAccountId ? accountMap[detailTransaction.toAccountId] : undefined}
        onClose={() => setDetailTransaction(null)}
      />

      <AddTransactionSheet
        visible={editTransaction !== null}
        initial={editTransaction}
        onClose={() => setEditTransaction(null)}
        onSuccess={() => load(filter, dateFilter)}
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

      <ConfirmDialog
        visible={undoneNotice}
        title="Transaction Deleted"
        message="This transaction was removed. You can find it in Settings > Transaction Archive."
        confirmLabel="OK"
        onConfirm={() => setUndoneNotice(false)}
        onCancel={() => setUndoneNotice(false)}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: {
    flex: 1,
    backgroundColor: c.bgPrimary,
  },
  header: {
    paddingHorizontal: theme.spacing[5],
    marginTop: theme.spacing[6],
    marginBottom: theme.spacing[4],
  },
  chips: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[2],
    marginBottom: theme.spacing[4],
  },
  summary: {
    gap: theme.spacing[4],
    marginHorizontal: theme.spacing[5],
    marginBottom: theme.spacing[2],
    padding: theme.spacing[5],
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: c.borderDefault,
    backgroundColor: c.bgSurface,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingTop: theme.spacing[4],
    borderTopWidth: 1,
    borderTopColor: c.borderDefault,
  },
  summaryCol: { flex: 1, gap: theme.spacing[1] },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: theme.spacing[5],
  },
  sectionHeader: {
    letterSpacing: 1,
    marginTop: theme.spacing[5],
    marginBottom: theme.spacing[3],
  },
}));
