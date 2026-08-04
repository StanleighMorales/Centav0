import React, { useState, useCallback, useRef } from 'react';
import { View, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Amount } from '../../src/components/ui/Amount';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FAB } from '../../src/components/ui/FAB';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { AddDebtSheet } from '../../src/components/debts/AddDebtSheet';
import { debtRepo, debtPaymentRepo, accountRepo } from '../../src/repositories';
import { theme } from '../../src/theme';
import { displayDate, monthRangeIso } from '../../src/utils/date';
import { formatPHP } from '../../src/utils/currency';
import { spendableAccounts } from '../../src/utils/accumulated';
import type { Account, Debt, DebtStatus, DebtType } from '../../src/domain/types';

const TYPE_TABS: DebtType[] = ['Credit', 'Loan', 'Custom'];
const STATUS_TABS: DebtStatus[] = ['Open', 'Overdue', 'Paid'];

type DebtRowProps = {
  debt: Debt;
  paidTotal: number;
  creditLimit: number | null;
  onPress: (d: Debt) => void;
  onEdit: (d: Debt) => void;
  onDelete: (d: Debt) => void;
};

function DebtRow({ debt, paidTotal, creditLimit, onPress, onEdit, onDelete }: DebtRowProps) {
  const swipeRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      renderRightActions={debt.linkedAccountId ? undefined : () => (
        <View style={styles.actions}>
          <Pressable
            onPress={() => { swipeRef.current?.close(); onEdit(debt); }}
            accessibilityRole="button"
            accessibilityLabel={`Edit debt from ${debt.creditor}`}
            style={styles.editAction}
          >
            <Feather name="edit-2" size={18} color={theme.colors.textPrimary} />
            <AppText variant="labelSm" color="textPrimary">Edit</AppText>
          </Pressable>
          <Pressable
            onPress={() => { swipeRef.current?.close(); onDelete(debt); }}
            accessibilityRole="button"
            accessibilityLabel={`Delete debt from ${debt.creditor}`}
            style={styles.deleteAction}
          >
            <Feather name="trash-2" size={18} color={theme.colors.textPrimary} />
            <AppText variant="labelSm" color="textPrimary">Delete</AppText>
          </Pressable>
        </View>
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
          ) : creditLimit != null ? (
            <View style={styles.paidTrail}>
              <Amount value={debt.outstandingBalance} variant="amountSm" semanticColor={false} color="negative" />
              <AppText variant="labelSm" color="positive">
                {formatPHP(Math.max(0, creditLimit - debt.outstandingBalance))} avail
              </AppText>
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
  const [activeType, setActiveType] = useState<DebtType>('Credit');
  const [activeStatus, setActiveStatus] = useState<DebtStatus>('Open');
  const [debts, setDebts] = useState<Debt[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editDebt, setEditDebt] = useState<Debt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null);
  const [paidTotals, setPaidTotals] = useState<Record<string, number>>({});
  const [monthPayments, setMonthPayments] = useState<{ debtId: string; amount: number }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const all = await debtRepo.list();
    const accs = await accountRepo.list();
    const allPayments = await debtPaymentRepo.list();
    const totals: Record<string, number> = {};
    for (const p of allPayments) totals[p.debtId] = (totals[p.debtId] ?? 0) + p.amount;
    const { from, to } = monthRangeIso();
    setDebts(all);
    setAccounts(accs);
    setPaidTotals(totals);
    setMonthPayments(allPayments.filter((p) => p.date >= from && p.date <= to));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleDelete() {
    if (!deleteTarget) return;
    await debtRepo.softDelete(deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  // Auto-managed credit cards stay hidden only while truly untouched — a fresh
  // card at ₱0 isn't a debt yet. One that was charged and paid off still has
  // payment history, so it stays visible (on the Paid tab) instead of vanishing.
  const typeDebts = debts.filter(
    (d) => d.debtType === activeType
      && !(d.linkedAccountId && d.outstandingBalance <= 0 && !(paidTotals[d.id] > 0)),
  );
  const typeDebtIds = new Set(typeDebts.map((d) => d.id));
  const paidThisMonth = monthPayments
    .filter((p) => typeDebtIds.has(p.debtId))
    .reduce((sum, p) => sum + p.amount, 0);
  const filtered = typeDebts.filter((d) => d.status === activeStatus);
  const activeDebts = typeDebts.filter((d) => d.status !== 'Paid');
  const totalDebt = activeDebts.reduce((sum, d) => sum + d.outstandingBalance, 0);
  const availableFunds = spendableAccounts(accounts)
    .reduce((sum, a) => sum + a.currentBalance, 0);
  const remainingAfterFunds = Math.max(0, totalDebt - availableFunds);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.title}>
        <ScreenHeader title="Debts" />
      </View>

      <View style={styles.tabRow}>
        {TYPE_TABS.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveType(tab)}
            accessibilityRole="tab"
            accessibilityLabel={tab}
            accessibilityState={{ selected: activeType === tab }}
            style={[styles.tab, activeType === tab && styles.tabActive]}
          >
            <AppText variant="labelLg" color={activeType === tab ? 'accentPrimary' : 'textSecondary'}>
              {tab}
            </AppText>
          </Pressable>
        ))}
      </View>

      <View style={styles.statusTabRow}>
        {STATUS_TABS.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveStatus(tab)}
            accessibilityRole="tab"
            accessibilityLabel={tab}
            accessibilityState={{ selected: activeStatus === tab }}
            style={[styles.statusChip, activeStatus === tab && styles.statusChipActive]}
          >
            <AppText variant="labelSm" color={activeStatus === tab ? 'accentPrimary' : 'textSecondary'}>
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
                <AppText variant="amountMd" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {formatPHP(totalDebt)}
                </AppText>
                <AppText variant="bodySm" color="textMuted">{activeDebts.length} active debts</AppText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <AppText variant="labelSm" color="textMuted">CASH + E-WALLETS</AppText>
                <AppText
                  variant="amountMd"
                  color={availableFunds >= totalDebt ? 'positive' : 'textPrimary'}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatPHP(availableFunds)}
                </AppText>
                <AppText variant="bodySm" color={remainingAfterFunds > 0 ? 'negative' : 'positive'}>
                  {remainingAfterFunds > 0 ? `${formatPHP(remainingAfterFunds)} left` : 'Covered'}
                </AppText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <AppText variant="labelSm" color="textMuted">PAID THIS MONTH</AppText>
                <AppText variant="amountMd" color="positive" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {formatPHP(paidThisMonth)}
                </AppText>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="credit-card"
              title={`No ${activeStatus.toLowerCase()} ${activeType.toLowerCase()} debts`}
              subtitle={activeStatus === 'Paid' ? 'Paid debts will appear here' : 'Tap + to add a debt'}
            />
          }
          renderItem={({ item }) => (
            <DebtRow
              debt={item}
              paidTotal={paidTotals[item.id] ?? 0}
              creditLimit={item.linkedAccountId ? accounts.find((a) => a.id === item.linkedAccountId)?.creditLimit ?? null : null}
              onPress={(d) => router.push(`/debts/${d.id}`)}
              onEdit={setEditDebt}
              onDelete={setDeleteTarget}
            />
          )}
        />
      )}

      <FAB onPress={() => setSheetVisible(true)} accessibilityLabel="Add debt" />

      <AddDebtSheet
        visible={sheetVisible}
        debtType={activeType}
        onClose={() => setSheetVisible(false)}
        onSuccess={load}
      />

      <AddDebtSheet
        visible={editDebt !== null}
        debtType={editDebt?.debtType ?? activeType}
        initial={editDebt ?? undefined}
        onClose={() => setEditDebt(null)}
        onSuccess={load}
      />

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete Debt"
        message={`Delete debt from "${deleteTarget?.creditor}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        destructive
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
  statusTabRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[2],
    marginBottom: theme.spacing[4],
  },
  statusChip: {
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgSurface,
  },
  statusChipActive: { backgroundColor: theme.colors.accentSubtle },
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
  summaryDivider: { width: 1, backgroundColor: theme.colors.borderDefault, marginHorizontal: theme.spacing[1] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.bgPrimary,
  },
  actions: { flexDirection: 'row', alignItems: 'stretch' },
  editAction: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    backgroundColor: theme.colors.bgElevated,
  },
  deleteAction: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    backgroundColor: theme.colors.negative,
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
