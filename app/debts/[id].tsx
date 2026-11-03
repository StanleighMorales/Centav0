import React, { useState, useCallback, useRef } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
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
import { CreditStatementsView, PurchaseLine } from '../../src/components/debts/CreditStatementsView';
import { EarlierBalanceSheet } from '../../src/components/debts/EarlierBalanceSheet';
import { debtRepo, debtPaymentRepo, accountRepo, transactionRepo, categoryRepo } from '../../src/repositories';
import { theme, makeStyles, useTheme } from '../../src/theme';
import { displayDate, groupByMonth, nowIso } from '../../src/utils/date';
import { formatPHP } from '../../src/utils/currency';
import { STATUS_COLOR, STATUS_LABEL, creditInfoFor } from '../../src/utils/creditStatements';
import type { Debt, DebtPayment, Account, Transaction } from '../../src/domain/types';

type Charge = Transaction & { label: string };

type MonthHeaderProps = {
  label: string;
  count: number;
  noun: string;
  total: number;
  color: 'positive';
  open: boolean;
  onPress: () => void;
};

// One collapsed line per month: its total and how many items, tap to show them.
function MonthHeader({ label, count, noun, total, color, open, onPress }: MonthHeaderProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const items = `${count} ${count === 1 ? noun : `${noun}s`}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${label}, ${items}, ${formatPHP(total)}`}
      style={({ pressed }) => [styles.paymentRow, pressed && styles.rowPressed]}
    >
      <View style={styles.paymentIconCircle}>
        <Feather name={open ? 'chevron-down' : 'chevron-right'} size={18} color={colors.textSecondary} />
      </View>
      <View style={styles.paymentInfo}>
        <AppText variant="body">{label}</AppText>
        <AppText variant="bodySm" color="textMuted">{items}</AppText>
      </View>
      <Amount value={total} variant="amountSm" color={color} semanticColor={false} />
    </Pressable>
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
  const [payPrefill, setPayPrefill] = useState<{ accountId?: string; amount?: number } | null>(null);
  const [earlierVisible, setEarlierVisible] = useState(false);
  // Expanded payment-history months; every month starts collapsed to its total.
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
      setPayPrefill({ accountId: voiceAccountId, amount: voiceAmount ? Number(voiceAmount) : undefined });
      setPaymentVisible(true);
    }
  }, [id, pay, voiceAccountId, voiceAmount]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const paymentMonths = groupByMonth(payments);
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
  const credit = creditAccount ? creditInfoFor(creditAccount, charges, payments, nowIso()) : null;
  const creditSummary = credit?.summary ?? null;
  // A credit line's status comes from its bills, not from owing something: future installments aren't overdue.
  const statusColor = credit
    ? STATUS_COLOR[credit.status]
    : debt.status === 'Overdue' ? 'negative' : debt.status === 'Paid' ? 'positive' : 'accentPrimary';
  const statusLabel = credit ? STATUS_LABEL[credit.status] : debt.status;

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
              <Amount
                value={debt.outstandingBalance}
                variant="amountLg"
                semanticColor={false}
                color={debt.outstandingBalance > 0 ? 'negative' : 'textPrimary'}
              />
              <AppText variant="bodySm" color="textMuted" style={styles.originalLabel}>
                owed of {formatPHP(linkedCreditLimit)} limit
              </AppText>
              <AppText variant="bodySm" color="positive">
                {formatPHP(creditAccount?.currentBalance ?? 0)} available
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
            earlierRemaining={credit.earlierRemaining}
            earlierMonths={creditAccount.earlierBalanceMonths}
            earlierFirstBill={creditAccount.earlierBalanceFirstBill}
            onChangeEarlier={() => setEarlierVisible(true)}
            purchases={charges}
            onEditPurchase={(cid) => setEditCharge(charges.find((c) => c.id === cid) ?? null)}
            onDeletePurchase={(cid) => setDeleteCharge(charges.find((c) => c.id === cid) ?? null)}
          />
        ) : null}

        {/* Without a bill date there are no bills to hold purchases, so list them plainly. */}
        {creditAccount && !credit && charges.length > 0 && (
          <>
            <AppText variant="h3" style={styles.sectionTitle}>Purchases</AppText>
            {charges.map((c) => (
              <PurchaseLine
                key={c.id}
                title={c.label}
                subtitle={`Bought ${displayDate(c.date)}`}
                amount={c.amount}
                onPress={() => setEditCharge(c)}
                onLongPress={() => setDeleteCharge(c)}
                accessibilityHint="Tap to edit, hold to delete"
              />
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
                <MonthHeader
                  label={m.label}
                  count={m.items.length}
                  noun="payment"
                  total={m.total}
                  color="positive"
                  open={open}
                  onPress={() => toggleMonth(m.key)}
                />
                {open
                  ? m.items.map((p) => (
                    <View key={p.id} style={[styles.paymentRow, styles.monthDetail]}>
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
        onClose={() => { setPaymentVisible(false); setPayPrefill(null); }}
        onSuccess={load}
        debtId={debt.id}
        creditor={debt.creditor}
        outstandingBalance={debt.outstandingBalance}
        // Before the bill date nothing is billed yet; offer the upcoming bill so it can be paid early.
        monthlyPayment={
          creditSummary
            ? creditSummary.dueNow || creditSummary.nextUnpaid?.remaining || undefined
            : debt.isInstallment ? debt.monthlyPayment ?? undefined : undefined
        }
        monthlyLabel={creditSummary ? (creditSummary.dueNow > 0 ? 'Due now' : 'Next bill') : undefined}
        cashOnly={!!creditAccount}
        initialAccountId={payPrefill?.accountId}
        initialAmount={payPrefill?.amount}
      />

      {creditAccount && credit ? (
        <EarlierBalanceSheet
          visible={earlierVisible}
          onClose={() => setEarlierVisible(false)}
          onSaved={load}
          account={creditAccount}
          amount={credit.earlierAmount}
          remaining={credit.earlierRemaining}
          onPay={() => {
            setEarlierVisible(false);
            setPayPrefill({ amount: credit.earlierRemaining });
            setPaymentVisible(true);
          }}
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
  rowPressed: { opacity: 0.6 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[5],
    marginTop: theme.spacing[3],
  },
  // Indented under its month, lined up with the month's text rather than its chevron.
  monthDetail: { paddingLeft: 36 + theme.spacing[4] },
}));
