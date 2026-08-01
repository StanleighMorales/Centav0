import React, { useState, useCallback } from 'react';
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
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
import { debtRepo, debtPaymentRepo, accountRepo, transactionRepo, categoryRepo } from '../../src/repositories';
import { theme } from '../../src/theme';
import { displayDate } from '../../src/utils/date';
import { formatPHP } from '../../src/utils/currency';
import type { Debt, DebtPayment, Account } from '../../src/domain/types';

type CategorySpend = { name: string; total: number };

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [debt, setDebt] = useState<Debt | null>(null);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategorySpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const d = await debtRepo.getById(id);
    const p = await debtPaymentRepo.listByDebt(id);
    const a = await accountRepo.list();
    setDebt(d);
    setPayments(p);
    setAccounts(a);
    if (d?.linkedAccountId) {
      const txns = await transactionRepo.list({ accountId: d.linkedAccountId, type: 'Expense' });
      const cats = await categoryRepo.list();
      const catName = Object.fromEntries(cats.map((c) => [c.id, c.name]));
      const totals: Record<string, number> = {};
      for (const t of txns) {
        if (!t.categoryId) continue;
        totals[t.categoryId] = (totals[t.categoryId] ?? 0) + t.amount;
      }
      setCategoryBreakdown(
        Object.entries(totals)
          .map(([categoryId, total]) => ({ name: catName[categoryId] ?? 'Other', total }))
          .sort((x, y) => y.total - x.total),
      );
    } else {
      setCategoryBreakdown([]);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  async function handleDelete() {
    if (!debt) return;
    await debtRepo.softDelete(debt.id);
    router.back();
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={theme.colors.accentPrimary} size="large" />
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

  const statusColor = debt.status === 'Overdue' ? 'negative' : debt.status === 'Paid' ? 'positive' : 'accentPrimary';
  const linkedCreditLimit = debt.linkedAccountId
    ? accounts.find((a) => a.id === debt.linkedAccountId)?.creditLimit ?? null
    : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={22} color={theme.colors.textPrimary} />
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
            <Feather name="edit-2" size={18} color={theme.colors.accentPrimary} />
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
            <AppText variant="labelLg" color={statusColor}>{debt.status}</AppText>
          </View>
          {debt.status === 'Paid' ? (
            <>
              <Amount value={totalPaid} variant="amountLg" semanticColor={false} color="positive" />
              <AppText variant="bodySm" color="textMuted" style={styles.originalLabel}>
                Fully paid • {formatPHP(debt.originalAmount)} borrowed
              </AppText>
            </>
          ) : linkedCreditLimit != null ? (
            <>
              <Amount value={debt.outstandingBalance} variant="amountLg" semanticColor={false} />
              <AppText variant="bodySm" color="textMuted" style={styles.originalLabel}>
                of {formatPHP(linkedCreditLimit)} limit
              </AppText>
              <AppText variant="bodySm" color="positive">
                {formatPHP(Math.max(0, linkedCreditLimit - debt.outstandingBalance))} available
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
          {debt.dueDate ? (
            <View style={styles.metaRow}>
              <Feather name="calendar" size={14} color={theme.colors.textMuted} />
              <AppText variant="bodySm" color={debt.status === 'Overdue' ? 'negative' : 'textMuted'}>
                Due {displayDate(debt.dueDate)}
              </AppText>
            </View>
          ) : null}
          {debt.isInstallment && debt.monthlyPayment != null ? (
            <View style={styles.metaRow}>
              <Feather name="repeat" size={14} color={theme.colors.textMuted} />
              <AppText variant="bodySm" color="textMuted">
                {formatPHP(debt.monthlyPayment)}/month installment
                {debt.installmentFee != null ? ` + ${formatPHP(debt.installmentFee)} fees` : ''}
              </AppText>
            </View>
          ) : null}
          {debt.interestRate != null ? (
            <View style={styles.metaRow}>
              <Feather name="percent" size={14} color={theme.colors.textMuted} />
              <AppText variant="bodySm" color="textMuted">{debt.interestRate}% interest</AppText>
            </View>
          ) : null}
          {debt.note ? (
            <AppText variant="bodySm" color="textMuted" style={styles.note}>{debt.note}</AppText>
          ) : null}
        </Card>

        {debt.status !== 'Paid' && (
          <View style={styles.actions}>
            <Button
              label="Add Payment"
              onPress={() => setPaymentVisible(true)}
              style={styles.flex}
            />
          </View>
        )}

        {categoryBreakdown.length > 0 && (
          <>
            <AppText variant="h3" style={styles.sectionTitle}>Charges by Category</AppText>
            {categoryBreakdown.map((c) => (
              <View key={c.name} style={styles.categoryRow}>
                <AppText variant="body" color="textSecondary">{c.name}</AppText>
                <Amount value={c.total} variant="amountSm" semanticColor={false} />
              </View>
            ))}
          </>
        )}

        <AppText variant="h3" style={styles.sectionTitle}>Payment History</AppText>

        {payments.length === 0 ? (
          <EmptyState icon="dollar-sign" title="No payments yet" subtitle="Record a payment above" />
        ) : (
          payments.map((p) => (
            <View key={p.id} style={styles.paymentRow}>
              <View style={styles.paymentIconCircle}>
                <Feather name="dollar-sign" size={18} color={theme.colors.positive} />
              </View>
              <View style={styles.paymentInfo}>
                <AppText variant="body">{displayDate(p.date)}</AppText>
                <AppText variant="bodySm" color="textMuted">
                  via {accountMap[p.accountId] ?? 'Unknown account'}
                </AppText>
              </View>
              <Amount value={p.amount} variant="amountSm" color="positive" semanticColor={false} />
            </View>
          ))
        )}

        {debt.linkedAccountId ? (
          <AppText variant="bodySm" color="textMuted" style={styles.linkedNote}>
            This debt tracks your Credit Card account automatically. Delete the account to remove it.
          </AppText>
        ) : (
          <Pressable
            onPress={() => setDeleteVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Delete debt"
            style={styles.deleteBtn}
          >
            <Feather name="trash-2" size={16} color={theme.colors.negative} />
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
        onClose={() => setPaymentVisible(false)}
        onSuccess={load}
        debtId={debt.id}
        creditor={debt.creditor}
        outstandingBalance={debt.outstandingBalance}
        monthlyPayment={debt.isInstallment ? debt.monthlyPayment ?? undefined : undefined}
      />

      <ConfirmDialog
        visible={deleteVisible}
        title="Delete Debt"
        message={`Delete debt from "${debt.creditor}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteVisible(false)}
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bgPrimary },
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
    borderBottomColor: theme.colors.borderDefault,
  },
  paymentIconCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing[4],
  },
  paymentInfo: { flex: 1, gap: theme.spacing[1] },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  linkedNote: {
    textAlign: 'center',
    marginTop: theme.spacing[3],
    paddingVertical: theme.spacing[5],
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[5],
    marginTop: theme.spacing[3],
  },
});
