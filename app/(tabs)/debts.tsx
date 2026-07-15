import React, { useState, useCallback, useRef } from 'react';
import { View, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { Amount } from '../../src/components/ui/Amount';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FAB } from '../../src/components/ui/FAB';
import { AddDebtSheet } from '../../src/components/debts/AddDebtSheet';
import { debtRepo, debtPaymentRepo, accountRepo } from '../../src/repositories';
import { theme } from '../../src/theme';
import { displayDate, monthRangeIso } from '../../src/utils/date';
import { formatPHP } from '../../src/utils/currency';
import type { Account, Debt, DebtStatus } from '../../src/domain/types';

const TABS: DebtStatus[] = ['Open', 'Overdue', 'Paid'];

type DebtRowProps = {
  debt: Debt;
  paidTotal: number;
  onPress: (d: Debt) => void;
  onEdit: (d: Debt) => void;
};

function DebtRow({ debt, paidTotal, onPress, onEdit }: DebtRowProps) {
  const swipeRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={() => { swipeRef.current?.close(); onEdit(debt); }}
          accessibilityRole="button"
          accessibilityLabel={`Edit debt from ${debt.creditor}`}
          style={styles.editAction}
        >
          <Feather name="edit-2" size={18} color={theme.colors.textPrimary} />
          <AppText variant="labelSm" color="textPrimary">Edit</AppText>
        </Pressable>
      )}
    >
      <Pressable
        onPress={() => onPress(debt)}
        accessibilityRole="button"
        accessibilityLabel={`View debt from ${debt.creditor}`}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={styles.iconCircle}>
          <Feather
            name="credit-card"
            size={18}
            color={
              debt.status === 'Overdue'
                ? theme.colors.negative
                : debt.status === 'Paid'
                ? theme.colors.positive
                : theme.colors.accentPrimary
            }
          />
        </View>
        <View style={styles.rowMain}>
          <AppText variant="body" style={styles.creditor}>{debt.creditor}</AppText>
          {debt.dueDate ? (
            <AppText
              variant="bodySm"
              color={debt.status === 'Overdue' ? 'negative' : 'textMuted'}
            >
              Due {displayDate(debt.dueDate)}
            </AppText>
          ) : null}
          {debt.isInstallment && debt.monthlyPayment != null ? (
            <AppText variant="bodySm" color="textMuted">
              {formatPHP(debt.monthlyPayment)}/mo installment
            </AppText>
          ) : null}
        </View>
        <View style={styles.rowTrail}>
          {debt.status === 'Paid' ? (
            <View style={styles.paidTrail}>
              <AppText variant="labelSm" color="positive">PAID</AppText>
              <Amount value={paidTotal} variant="amountSm" semanticColor={false} color="positive" />
            </View>
          ) : (
            <Amount value={debt.outstandingBalance} variant="amountSm" semanticColor={false} />
          )}
          <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
        </View>
      </Pressable>
    </Swipeable>
  );
}

export default function DebtsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DebtStatus>('Open');
  const [debts, setDebts] = useState<Debt[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editDebt, setEditDebt] = useState<Debt | null>(null);
  const [paidTotals, setPaidTotals] = useState<Record<string, number>>({});
  const [paidThisMonth, setPaidThisMonth] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const all = await debtRepo.list();
    const accs = await accountRepo.list();
    const allPayments = await debtPaymentRepo.list();
    const totals: Record<string, number> = {};
    for (const p of allPayments) totals[p.debtId] = (totals[p.debtId] ?? 0) + p.amount;
    const { from, to } = monthRangeIso();
    const monthTotal = allPayments
      .filter((p) => p.date >= from && p.date <= to)
      .reduce((sum, p) => sum + p.amount, 0);
    setDebts(all);
    setAccounts(accs);
    setPaidTotals(totals);
    setPaidThisMonth(monthTotal);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = debts.filter((d) => d.status === activeTab);
  const activeDebts = debts.filter((d) => d.status !== 'Paid');
  const totalDebt = activeDebts.reduce((sum, d) => sum + d.outstandingBalance, 0);
  const availableFunds = accounts
    .filter((a) => a.type === 'Cash' || a.type === 'EWallet')
    .reduce((sum, a) => sum + a.currentBalance, 0);
  const remainingAfterFunds = Math.max(0, totalDebt - availableFunds);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppText variant="h2" style={styles.title}>Debts</AppText>

      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="tab"
            accessibilityLabel={tab}
            accessibilityState={{ selected: activeTab === tab }}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
          >
            <AppText variant="labelLg" color={activeTab === tab ? 'accentPrimary' : 'textSecondary'}>
              {tab}
            </AppText>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={theme.colors.accentPrimary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: 80 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.summary}>
              <View style={styles.summaryCol}>
                <AppText variant="labelSm" color="textMuted">TOTAL DEBT</AppText>
                <AppText variant="amountMd">{formatPHP(totalDebt)}</AppText>
                <AppText variant="bodySm" color="textMuted">{activeDebts.length} active debts</AppText>
              </View>
              <View style={styles.summaryCol}>
                <AppText variant="labelSm" color="textMuted">CASH + E-WALLETS</AppText>
                <AppText variant="amountMd" color={availableFunds >= totalDebt ? 'positive' : 'textPrimary'}>
                  {formatPHP(availableFunds)}
                </AppText>
                <AppText variant="bodySm" color={remainingAfterFunds > 0 ? 'negative' : 'positive'}>
                  {remainingAfterFunds > 0 ? `${formatPHP(remainingAfterFunds)} left` : 'Covered'}
                </AppText>
              </View>
              <View style={styles.summaryCol}>
                <AppText variant="labelSm" color="textMuted">PAID THIS MONTH</AppText>
                <AppText variant="amountMd" color="positive">{formatPHP(paidThisMonth)}</AppText>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="credit-card"
              title={`No ${activeTab.toLowerCase()} debts`}
              subtitle={activeTab === 'Paid' ? 'Paid debts will appear here' : 'Tap + to add a debt'}
            />
          }
          renderItem={({ item }) => (
            <DebtRow
              debt={item}
              paidTotal={paidTotals[item.id] ?? 0}
              onPress={(d) => router.push(`/debts/${d.id}`)}
              onEdit={setEditDebt}
            />
          )}
        />
      )}

      <FAB onPress={() => setSheetVisible(true)} accessibilityLabel="Add debt" />

      <AddDebtSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSuccess={load}
      />

      <AddDebtSheet
        visible={editDebt !== null}
        initial={editDebt ?? undefined}
        onClose={() => setEditDebt(null)}
        onSuccess={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  title: {
    paddingHorizontal: theme.spacing[5],
    marginTop: theme.spacing[5],
    marginBottom: theme.spacing[4],
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[3],
    marginBottom: theme.spacing[4],
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing[3],
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: theme.colors.accentPrimary },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: theme.spacing[5] },
  summary: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
    flexDirection: 'row',
    gap: theme.spacing[4],
    marginBottom: theme.spacing[4],
    ...theme.shadows.sm,
  },
  summaryCol: { flex: 1, gap: theme.spacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.bgPrimary,
  },
  editAction: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    backgroundColor: theme.colors.bgElevated,
  },
  rowPressed: { opacity: 0.6 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing[4],
  },
  rowMain: { flex: 1, gap: theme.spacing[1] },
  creditor: { fontWeight: '600' },
  rowTrail: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  paidTrail: { alignItems: 'flex-end', gap: theme.spacing[1] },
});
