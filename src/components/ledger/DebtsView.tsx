import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, FlatList, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../ui/AppText';
import { Chip } from '../ui/Chip';
import { Amount } from '../ui/Amount';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { AddDebtSheet } from '../debts/AddDebtSheet';
import { AddAccountSheet } from '../accounts/AddAccountSheet';
import { MonthlyDebtView } from '../debts/MonthlyDebtView';
import { InstallmentGridView } from '../debts/InstallmentGridView';
import { debtRepo, debtPaymentRepo, accountRepo, transactionRepo } from '../../repositories';
import { TAB_BAR_SPACE } from '../nav/FloatingTabBar';
import { theme, makeStyles, useTheme } from '../../theme';
import { displayDate, monthRangeIso, nowIso } from '../../utils/date';
import { STATUS_COLOR, creditStatus, statementsFor, summarize, type Statement, type StatementStatus } from '../../utils/creditStatements';
import { formatPHP } from '../../utils/currency';
import { spendableAccounts } from '../../utils/accumulated';
import type { Account, Debt, DebtPayment, DebtStatus, DebtType, Transaction } from '../../domain/types';

type CreditInfo = ReturnType<typeof summarize> & { status: StatementStatus; statements: Statement[] };

const TYPE_TABS: DebtType[] = ['Credit', 'Loan', 'Custom'];
const STATUS_TABS: DebtStatus[] = ['Open', 'Overdue', 'Paid'];
const VIEW_MODES = ['List', 'Monthly', 'Grid'] as const;
type ViewMode = (typeof VIEW_MODES)[number];

type DebtRowProps = {
  debt: Debt;
  paidTotal: number;
  creditLimit: number | null;
  /** Bills for a credit line with bill and due days set. */
  credit: CreditInfo | null;
  onPress: (d: Debt) => void;
  onEdit: (d: Debt) => void;
  onDelete: (d: Debt) => void;
};

function DebtRow({ debt, paidTotal, creditLimit, credit, onPress, onEdit, onDelete }: DebtRowProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const swipeRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      containerStyle={styles.card}
      renderRightActions={debt.linkedAccountId ? undefined : () => (
        <View style={styles.actions}>
          <Pressable
            onPress={() => { swipeRef.current?.close(); onEdit(debt); }}
            accessibilityRole="button"
            accessibilityLabel={`Edit debt from ${debt.creditor}`}
            style={styles.editAction}
          >
            <Feather name="edit-2" size={18} color={colors.textPrimary} />
            <AppText variant="labelSm" color="textPrimary">Edit</AppText>
          </Pressable>
          <Pressable
            onPress={() => { swipeRef.current?.close(); onDelete(debt); }}
            accessibilityRole="button"
            accessibilityLabel={`Delete debt from ${debt.creditor}`}
            style={styles.deleteAction}
          >
            <Feather name="trash-2" size={18} color={colors.textPrimary} />
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
              credit
                ? credit.status === 'upcoming' || credit.status === 'due' ? colors.accentPrimary : colors[STATUS_COLOR[credit.status]]
                : debt.status === 'Overdue'
                ? colors.negative
                : debt.status === 'Paid'
                ? colors.positive
                : colors.accentPrimary
            }
          />
        </View>
        <View style={styles.rowMain}>
          <AppText variant="body" style={styles.creditor}>{debt.creditor}</AppText>
          {credit ? (
            credit.overdue > 0 ? (
              <View style={styles.paidRow}>
                <Feather name="alert-circle" size={12} color={colors.negative} style={styles.rowNoteIcon} />
                <AppText variant="bodySm" color="negative" style={styles.rowNote}>{formatPHP(credit.overdue)} overdue</AppText>
              </View>
            ) : credit.nextUnpaid ? (
              // The next bill with anything left, even before its bill date: new purchases are already on it.
              <AppText variant="bodySm" color={credit.nextUnpaid.status === 'dueSoon' ? 'warning' : 'textSecondary'}>
                {formatPHP(credit.nextUnpaid.remaining)} unpaid · due {displayDate(credit.nextUnpaid.dueDate)}
              </AppText>
            ) : (
              <View style={styles.paidRow}>
                <Feather name="check" size={12} color={colors.positive} style={styles.rowNoteIcon} />
                <AppText variant="bodySm" color="positive" style={styles.rowNote}>All paid</AppText>
              </View>
            )
          ) : debt.dueDate ? (
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
            // Owed in red, credit still available in green.
            <View style={styles.paidTrail}>
              <Amount
                value={debt.outstandingBalance}
                variant="amountSm"
                semanticColor={false}
                color={debt.outstandingBalance > 0 ? 'negative' : 'textPrimary'}
              />
              <AppText variant="labelSm" color="positive">
                {formatPHP(Math.max(0, creditLimit - debt.outstandingBalance))} avail
              </AppText>
            </View>
          ) : (
            <Amount value={debt.outstandingBalance} variant="amountSm" semanticColor={false} />
          )}
          <Feather name="chevron-right" size={16} color={colors.textMuted} />
        </View>
      </Pressable>
    </Swipeable>
  );
}

export function DebtsView({ addSignal }: { addSignal: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('List');
  const [activeType, setActiveType] = useState<DebtType>('Credit');
  const [activeStatus, setActiveStatus] = useState<DebtStatus>('Open');
  const [debts, setDebts] = useState<Debt[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editDebt, setEditDebt] = useState<Debt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null);
  const [paidTotals, setPaidTotals] = useState<Record<string, number>>({});
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [creditCharges, setCreditCharges] = useState<Transaction[]>([]);
  const [creditSheetVisible, setCreditSheetVisible] = useState(false);
  const [monthPayments, setMonthPayments] = useState<{ debtId: string; amount: number }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const all = await debtRepo.list();
    const accs = await accountRepo.list();
    const allPayments = await debtPaymentRepo.list();
    const totals: Record<string, number> = {};
    for (const p of allPayments) totals[p.debtId] = (totals[p.debtId] ?? 0) + p.amount;
    // Purchases on credit lines feed their monthly statements.
    const creditIds = new Set(accs.filter((a) => a.allowsOverdraft).map((a) => a.id));
    const expenses = await transactionRepo.list({ type: 'Expense' });
    const { from, to } = monthRangeIso();
    setDebts(all);
    setAccounts(accs);
    setPaidTotals(totals);
    setPayments(allPayments);
    setCreditCharges(expenses.filter((t) => creditIds.has(t.accountId)));
    setMonthPayments(allPayments.filter((p) => p.date >= from && p.date <= to));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // The tab bar's + bumps addSignal on Ledger; the first value is just the initial mount.
  const firstSignal = useRef(addSignal);
  useEffect(() => {
    if (addSignal === firstSignal.current) return;
    if (activeType === 'Credit') setCreditSheetVisible(true);
    else setSheetVisible(true);
  }, [addSignal]);

  async function handleDelete() {
    if (!deleteTarget) return;
    await debtRepo.softDelete(deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  const today = nowIso();
  const creditInfo: Record<string, CreditInfo> = {};
  for (const d of debts) {
    const account = d.linkedAccountId ? accounts.find((a) => a.id === d.linkedAccountId) : undefined;
    if (!account) continue;
    const built = statementsFor(
      account,
      creditCharges.filter((t) => t.accountId === account.id),
      payments.filter((p) => p.debtId === d.id),
      d.outstandingBalance,
      today,
    );
    if (!built) continue;
    const summary = summarize(built.statements, today);
    creditInfo[d.id] = { ...summary, status: creditStatus(summary), statements: built.statements };
  }
  const tabStatus = (d: Debt): DebtStatus => {
    const c = creditInfo[d.id];
    if (!c) return d.status;
    return c.overdue > 0 ? 'Overdue' : d.outstandingBalance <= 0 ? 'Paid' : 'Open';
  };

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
  const filtered = typeDebts.filter((d) => tabStatus(d) === activeStatus);
  const activeDebts = typeDebts.filter((d) => tabStatus(d) !== 'Paid');
  const totalDebt = activeDebts.reduce((sum, d) => sum + d.outstandingBalance, 0);
  const availableFunds = spendableAccounts(accounts)
    .reduce((sum, a) => sum + a.currentBalance, 0);
  const remainingAfterFunds = Math.max(0, totalDebt - availableFunds);

  return (
    <View style={styles.root}>
      <View style={styles.viewModeRow}>
        {VIEW_MODES.map((mode) => (
          <Chip key={mode} label={mode} selected={viewMode === mode} onPress={() => setViewMode(mode)} />
        ))}
      </View>

      {viewMode === 'Monthly' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + insets.bottom }}
        >
          <MonthlyDebtView
            debts={debts}
            accounts={accounts}
            credit={Object.fromEntries(Object.entries(creditInfo).map(([id, c]) => [id, c.statements]))}
          />
        </ScrollView>
      ) : viewMode === 'Grid' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + insets.bottom }}
        >
          <InstallmentGridView debts={debts} accounts={accounts} />
        </ScrollView>
      ) : (
        <>
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
          <Chip key={tab} label={tab} selected={activeStatus === tab} onPress={() => setActiveStatus(tab)} />
        ))}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accentPrimary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_SPACE + insets.bottom }]}
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
              subtitle={activeStatus === 'Paid' ? 'Paid debts will appear here' : activeType === 'Credit' ? 'Tap + to add a credit line' : 'Tap + to add a debt'}
            />
          }
          renderItem={({ item }) => (
            <DebtRow
              debt={item}
              paidTotal={paidTotals[item.id] ?? 0}
              creditLimit={item.linkedAccountId ? accounts.find((a) => a.id === item.linkedAccountId)?.creditLimit ?? null : null}
              credit={creditInfo[item.id] ?? null}
              onPress={(d) => router.push(`/debts/${d.id}`)}
              onEdit={setEditDebt}
              onDelete={setDeleteTarget}
            />
          )}
        />
      )}
        </>
      )}

      <AddDebtSheet
        visible={sheetVisible}
        debtType={activeType}
        onClose={() => setSheetVisible(false)}
        onSuccess={load}
      />

      <AddAccountSheet
        visible={creditSheetVisible}
        creditOnly
        onClose={() => setCreditSheetVisible(false)}
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

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bgPrimary },
  viewModeRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[2],
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
  tabActive: { borderBottomColor: c.accentPrimary },
  statusTabRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[2],
    marginBottom: theme.spacing[4],
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: theme.spacing[5] },
  summary: {
    backgroundColor: c.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
    flexDirection: 'row',
    gap: theme.spacing[4],
    marginBottom: theme.spacing[4],
    ...theme.shadows.sm,
  },
  summaryCol: { flex: 1, gap: theme.spacing[2] },
  summaryDivider: { width: 1, backgroundColor: c.borderDefault, marginHorizontal: theme.spacing[1] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing[4],
    backgroundColor: c.bgSurface,
  },
  card: {
    marginBottom: theme.spacing[3],
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: c.borderDefault,
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row', alignItems: 'stretch' },
  editAction: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    backgroundColor: c.bgElevated,
  },
  deleteAction: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    backgroundColor: c.negative,
  },
  rowPressed: { opacity: 0.6 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing[4],
  },
  // The gap keeps a long status line from running into the amounts on the right.
  rowMain: { flex: 1, gap: theme.spacing[1], marginRight: theme.spacing[3] },
  creditor: { fontWeight: '600' },
  rowTrail: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  paidTrail: { alignItems: 'flex-end', gap: theme.spacing[1] },
  paidRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[1] },
  // Text in a row only wraps if it may shrink; without this it overflowed under the amounts.
  rowNote: { flexShrink: 1 },
  // Centres the icon on the first line of text when the line wraps.
  rowNoteIcon: { marginTop: theme.spacing[1] },
}));
