import React, { useState, useCallback, useRef } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { Amount } from '../../src/components/ui/Amount';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { AddDebtSheet } from '../../src/components/debts/AddDebtSheet';
import { AddPaymentSheet } from '../../src/components/debts/AddPaymentSheet';
import { AddTransactionSheet } from '../../src/components/dashboard/AddTransactionSheet';
import { CreditStatementsView } from '../../src/components/debts/CreditStatementsView';
import { EarlierBalanceSheet } from '../../src/components/debts/EarlierBalanceSheet';
import { debtRepo, debtPaymentRepo, accountRepo, transactionRepo, categoryRepo } from '../../src/repositories';
import { theme, makeStyles, useTheme } from '../../src/theme';
import { displayDate, nowIso } from '../../src/utils/date';
import { formatPHP } from '../../src/utils/currency';
import { STATUS_COLOR, STATUS_LABEL, creditStatus, statementsFor, summarize } from '../../src/utils/creditStatements';
import type { Debt, DebtPayment, Account, Transaction } from '../../src/domain/types';

type Charge = Transaction & { label: string };

const CHARGE_ACTION_WIDTH = 76;

type ChargeRowProps = {
  charge: Charge;
  onEdit: (c: Charge) => void;
  onDelete: (c: Charge) => void;
};

function ChargeRow({ charge, onEdit, onDelete }: ChargeRowProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const swipeRef = useRef<Swipeable>(null);
  const close = () => swipeRef.current?.close();

  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      renderRightActions={(progress) => (
        <Animated.View
          style={[
            styles.chargeActions,
            {
              transform: [{
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [CHARGE_ACTION_WIDTH * 2, 0],
                }),
              }],
            },
          ]}
        >
          <Pressable
            onPress={() => { close(); onEdit(charge); }}
            accessibilityRole="button"
            accessibilityLabel={`Edit charge ${charge.label}`}
            style={[styles.chargeAction, styles.chargeEditAction]}
          >
            <Feather name="edit-2" size={18} color={colors.textPrimary} />
            <AppText variant="labelSm" color="textPrimary">Edit</AppText>
          </Pressable>
          <Pressable
            onPress={() => { close(); onDelete(charge); }}
            accessibilityRole="button"
            accessibilityLabel={`Delete charge ${charge.label}`}
            style={[styles.chargeAction, styles.chargeDeleteAction]}
          >
            <Feather name="trash-2" size={18} color={colors.textPrimary} />
            <AppText variant="labelSm" color="textPrimary">Delete</AppText>
          </Pressable>
        </Animated.View>
      )}
    >
      <Pressable
        onPress={() => onEdit(charge)}
        accessibilityRole="button"
        accessibilityLabel={`Edit charge ${charge.label}, ${formatPHP(charge.amount)}`}
        style={({ pressed }) => [styles.chargeRow, pressed && styles.rowPressed]}
      >
        <View style={styles.chargeInfo}>
          <AppText variant="body">{charge.label}</AppText>
          <AppText variant="bodySm" color="textMuted">
            {displayDate(charge.date)}
            {charge.installmentMonths && charge.installmentMonths > 1
              ? ` · ${charge.installmentMonths} months · ${formatPHP(Math.round((charge.amount / charge.installmentMonths) * 100) / 100)}/mo`
              : ''}
          </AppText>
        </View>
        <Amount value={charge.amount} variant="amountSm" semanticColor={false} />
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </Pressable>
    </Swipeable>
  );
}

export default function DebtDetailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  // pay/accountId/amount come from a voice command: open the payment sheet once, prefilled.
  const { id, pay, accountId: voiceAccountId, amount: voiceAmount } =
    useLocalSearchParams<{ id: string; pay?: string; accountId?: string; amount?: string }>();
  const voicePayDone = useRef(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [debt, setDebt] = useState<Debt | null>(null);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [editCharge, setEditCharge] = useState<Charge | null>(null);
  const [deleteCharge, setDeleteCharge] = useState<Charge | null>(null);
  const [chargeDeletedNotice, setChargeDeletedNotice] = useState(false);
  const [voicePrefill, setVoicePrefill] = useState<{ accountId?: string; amount?: number } | null>(null);
  const [earlierVisible, setEarlierVisible] = useState(false);
  // Payment history months that are expanded; every month starts collapsed to its total.
  const [openMonths, setOpenMonths] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const d = await debtRepo.getById(id);
    const p = await debtPaymentRepo.listByDebt(id);
    const a = await accountRepo.list();
    setDebt(d);
    setPayments(p);
    setAccounts(a);
    let purchases: Charge[] = [];
    if (d?.linkedAccountId) {
      // Every purchase on a credit line feeds its statements; payments decide what's still owed.
      const txns = await transactionRepo.list({ accountId: d.linkedAccountId, type: 'Expense' });
      const cats = await categoryRepo.list();
      const catName = Object.fromEntries(cats.map((c) => [c.id, c.name]));
      purchases = txns.map((t) => ({ ...t, label: t.note || catName[t.categoryId ?? ''] || 'Charge' }));
    }
    setCharges(purchases);
    setLoading(false);

    if (pay === '1' && d && !voicePayDone.current && d.outstandingBalance > 0) {
      voicePayDone.current = true;
      setVoicePrefill({ accountId: voiceAccountId, amount: voiceAmount ? Number(voiceAmount) : undefined });
      setPaymentVisible(true);
    }
  }, [id, pay, voiceAccountId, voiceAmount]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  // Payments arrive newest first, and object keys keep insertion order, so months stay newest first.
  const paymentMonths = Object.values(
    payments.reduce<Record<string, { key: string; label: string; total: number; items: DebtPayment[] }>>((acc, p) => {
      const d = new Date(p.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const month = (acc[key] ??= {
        key,
        label: d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
        total: 0,
        items: [],
      });
      month.total += p.amount;
      month.items.push(p);
      return acc;
    }, {}),
  );
  const toggleMonth = (key: string) =>
    setOpenMonths((open) => (open.includes(key) ? open.filter((k) => k !== key) : [...open, key]));

  async function handleDelete() {
    if (!debt) return;
    await debtRepo.softDelete(debt.id);
    router.back();
  }

  async function handleDeleteCharge() {
    if (!deleteCharge) return;
    await transactionRepo.softDelete(deleteCharge.id);
    setDeleteCharge(null);
    setChargeDeletedNotice(true);
    load();
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accentPrimary} size="large" />
      </View>
    );
  }

  if (!debt) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <AppText variant="body" color="textMuted">Debt not found.</AppText>
      </View>
    );
  }

  const creditAccount = debt.linkedAccountId ? accounts.find((a) => a.id === debt.linkedAccountId) : undefined;
  const linkedCreditLimit = creditAccount?.creditLimit ?? null;
  const today = nowIso();
  const credit = creditAccount ? statementsFor(creditAccount, charges, payments, debt.outstandingBalance, today) : null;
  const creditSummary = credit ? summarize(credit.statements, today) : null;
  // A credit line's status comes from its bills, not from owing something: future installments aren't overdue.
  const badge = creditSummary ? creditStatus(creditSummary, debt.outstandingBalance) : null;
  const statusColor = badge
    ? STATUS_COLOR[badge]
    : debt.status === 'Overdue' ? 'negative' : debt.status === 'Paid' ? 'positive' : 'accentPrimary';
  const statusLabel = badge ? STATUS_LABEL[badge] : debt.status;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <AppText variant="h2" style={styles.flex}>Debt Detail</AppText>
        {debt.linkedAccountId ? (
          <View style={styles.iconBtn} />
        ) : (
          <Pressable
            onPress={() => setEditVisible(true)}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Edit debt"
          >
            <Feather name="edit-2" size={18} color={colors.accentPrimary} />
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <AppText variant="h3" style={styles.flex}>{debt.creditor}</AppText>
            <AppText variant="labelLg" color={statusColor}>{statusLabel}</AppText>
          </View>
          {linkedCreditLimit != null ? (
            <>
              <Amount value={debt.outstandingBalance} variant="amountLg" semanticColor={false} />
              <AppText variant="bodySm" color="textMuted" style={styles.originalLabel}>
                owed of {formatPHP(linkedCreditLimit)} limit
              </AppText>
              <AppText variant="bodySm" color="textSecondary">
                {formatPHP(Math.max(0, linkedCreditLimit - debt.outstandingBalance))} available
              </AppText>
            </>
          ) : debt.status === 'Paid' ? (
            <>
              <Amount value={totalPaid} variant="amountLg" semanticColor={false} color="positive" />
              <AppText variant="bodySm" color="textMuted" style={styles.originalLabel}>
                Fully paid • {formatPHP(debt.originalAmount)} borrowed
              </AppText>
            </>
          ) : (
            <>
              <Amount value={debt.outstandingBalance} variant="amountLg" semanticColor={false} />
              <AppText variant="bodySm" color="textMuted" style={styles.originalLabel}>
                of {formatPHP(debt.originalAmount)} borrowed
              </AppText>
            </>
          )}
          {creditAccount && !credit ? (
            <AppText variant="bodySm" color="textMuted" style={styles.originalLabel}>
              Set a bill date and due date on this account to see monthly bills.
            </AppText>
          ) : null}
          {debt.dueDate && !credit ? (
            <View style={styles.metaRow}>
              <Feather name="calendar" size={14} color={colors.textMuted} />
              <AppText variant="bodySm" color={debt.status === 'Overdue' ? 'negative' : 'textMuted'}>
                Due {displayDate(debt.dueDate)}
              </AppText>
            </View>
          ) : null}
          {debt.isInstallment && debt.monthlyPayment != null ? (
            <View style={styles.metaRow}>
              <Feather name="repeat" size={14} color={colors.textMuted} />
              <AppText variant="bodySm" color="textMuted">
                {formatPHP(debt.monthlyPayment)}/month installment
                {debt.installmentFee != null ? ` + ${formatPHP(debt.installmentFee)} fees` : ''}
              </AppText>
            </View>
          ) : null}
          {debt.interestRate != null ? (
            <View style={styles.metaRow}>
              <Feather name="percent" size={14} color={colors.textMuted} />
              <AppText variant="bodySm" color="textMuted">{debt.interestRate}% interest</AppText>
            </View>
          ) : null}
          {debt.note ? (
            <AppText variant="bodySm" color="textMuted" style={styles.note}>{debt.note}</AppText>
          ) : null}
        </Card>

        {(creditAccount ? debt.outstandingBalance > 0 : debt.status !== 'Paid') && (
          <View style={styles.actions}>
            <Button
              label={creditAccount ? 'Pay' : 'Add Payment'}
              onPress={() => setPaymentVisible(true)}
              style={styles.flex}
            />
          </View>
        )}

        {credit && creditSummary && creditAccount ? (
          <CreditStatementsView
            statements={credit.statements}
            summary={creditSummary}
            earlierAmount={credit.earlierAmount}
            earlierMonths={creditAccount.earlierBalanceMonths}
            earlierFirstBill={creditAccount.earlierBalanceFirstBill}
            onChangeEarlier={() => setEarlierVisible(true)}
          />
        ) : null}

        {debt.linkedAccountId && charges.length > 0 && (
          <>
            <AppText variant="h3" style={styles.sectionTitle}>Purchases</AppText>
            {charges.map((c) => (
              <ChargeRow key={c.id} charge={c} onEdit={setEditCharge} onDelete={setDeleteCharge} />
            ))}
          </>
        )}

        <AppText variant="h3" style={styles.sectionTitle}>Payment History</AppText>

        {payments.length === 0 ? (
          <EmptyState icon="dollar-sign" title="No payments yet" subtitle="Record a payment above" />
        ) : (
          paymentMonths.map((m) => {
            const open = openMonths.includes(m.key);
            return (
              <View key={m.key}>
                <Pressable
                  onPress={() => toggleMonth(m.key)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  accessibilityLabel={`${m.label}, ${m.items.length} ${m.items.length === 1 ? 'payment' : 'payments'}, ${formatPHP(m.total)}`}
                  style={({ pressed }) => [styles.paymentRow, pressed && styles.rowPressed]}
                >
                  <View style={styles.paymentIconCircle}>
                    <Feather name={open ? 'chevron-down' : 'chevron-right'} size={18} color={colors.textSecondary} />
                  </View>
                  <View style={styles.paymentInfo}>
                    <AppText variant="body">{m.label}</AppText>
                    <AppText variant="bodySm" color="textMuted">
                      {m.items.length} {m.items.length === 1 ? 'payment' : 'payments'}
                    </AppText>
                  </View>
                  <Amount value={m.total} variant="amountSm" color="positive" semanticColor={false} />
                </Pressable>
                {open
                  ? m.items.map((p) => (
                    <View key={p.id} style={[styles.paymentRow, styles.paymentDetail]}>
                      <View style={styles.paymentInfo}>
                        <AppText variant="body">{displayDate(p.date)}</AppText>
                        <AppText variant="bodySm" color="textMuted">
                          via {accountMap[p.accountId] ?? 'Unknown account'}
                        </AppText>
                      </View>
                      <Amount value={p.amount} variant="amountSm" color="positive" semanticColor={false} />
                    </View>
                  ))
                  : null}
              </View>
            );
          })
        )}

        {debt.linkedAccountId ? null : (
          <Pressable
            onPress={() => setDeleteVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Delete debt"
            style={styles.deleteBtn}
          >
            <Feather name="trash-2" size={16} color={colors.negative} />
            <AppText variant="body" color="negative">Delete Debt</AppText>
          </Pressable>
        )}
      </ScrollView>

      <AddDebtSheet
        visible={editVisible}
        debtType={debt.debtType}
        onClose={() => setEditVisible(false)}
        onSuccess={load}
        initial={debt}
      />

      <AddPaymentSheet
        visible={paymentVisible}
        onClose={() => { setPaymentVisible(false); setVoicePrefill(null); }}
        onSuccess={load}
        debtId={debt.id}
        creditor={debt.creditor}
        outstandingBalance={debt.outstandingBalance}
        // Before the bill date nothing is billed yet; offer the upcoming bill so it can be paid early.
        monthlyPayment={
          creditSummary
            ? creditSummary.dueNow || creditSummary.next?.remaining || undefined
            : debt.isInstallment ? debt.monthlyPayment ?? undefined : undefined
        }
        monthlyLabel={creditSummary ? (creditSummary.dueNow > 0 ? 'Due now' : 'Next bill') : undefined}
        cashOnly={!!creditAccount}
        initialAccountId={voicePrefill?.accountId}
        initialAmount={voicePrefill?.amount}
      />

      {creditAccount && credit ? (
        <EarlierBalanceSheet
          visible={earlierVisible}
          onClose={() => setEarlierVisible(false)}
          onSaved={load}
          account={creditAccount}
          amount={credit.earlierAmount}
        />
      ) : null}

      <ConfirmDialog
        visible={deleteVisible}
        title="Delete Debt"
        message={`Delete debt from "${debt.creditor}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteVisible(false)}
        destructive
      />

      <AddTransactionSheet
        visible={editCharge !== null}
        initial={editCharge}
        lockAccountAndType
        onClose={() => setEditCharge(null)}
        onSuccess={() => { setEditCharge(null); load(); }}
      />

      <ConfirmDialog
        visible={deleteCharge !== null}
        title="Delete Charge"
        message={`Delete charge "${deleteCharge?.label}" (${formatPHP(deleteCharge?.amount ?? 0)})? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteCharge}
        onCancel={() => setDeleteCharge(null)}
        destructive
      />

      <ConfirmDialog
        visible={chargeDeletedNotice}
        title="Charge Deleted"
        message="This charge was removed and its amount was returned to your available credit. You can find it in Settings > Transaction Archive."
        confirmLabel="OK"
        onConfirm={() => setChargeDeletedNotice(false)}
        onCancel={() => setChargeDeletedNotice(false)}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bgPrimary },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[4],
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -theme.spacing[2],
  },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: theme.spacing[5], gap: theme.spacing[5] },
  summaryCard: { gap: theme.spacing[2] },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] },
  originalLabel: { marginTop: theme.spacing[1] },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    marginTop: theme.spacing[2],
  },
  note: { marginTop: theme.spacing[3], fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: theme.spacing[3] },
  sectionTitle: {},
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: c.borderDefault,
  },
  paymentIconCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing[4],
  },
  paymentInfo: { flex: 1, gap: theme.spacing[1] },
  // Indented under its month, lined up with the month's text rather than its chevron.
  paymentDetail: { paddingLeft: 36 + theme.spacing[4] },
  chargeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: c.borderDefault,
  },
  chargeInfo: { flex: 1, gap: theme.spacing[1] },
  rowPressed: { opacity: 0.6 },
  chargeActions: { flexDirection: 'row', alignItems: 'stretch' },
  chargeAction: {
    width: CHARGE_ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
  },
  chargeEditAction: { backgroundColor: c.bgElevated },
  chargeDeleteAction: { backgroundColor: c.negative },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[5],
    marginTop: theme.spacing[3],
  },
}));
