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
import { AddLendingSheet } from '../../src/components/lending/AddLendingSheet';
import { AddLendingPaymentSheet } from '../../src/components/lending/AddLendingPaymentSheet';
import { lendingRepo, lendingPaymentRepo, lendingPersonRepo, accountRepo } from '../../src/repositories';
import { theme } from '../../src/theme';
import { displayDate } from '../../src/utils/date';
import { formatPHP } from '../../src/utils/currency';
import type { Lending, LendingPayment, Account } from '../../src/domain/types';

export default function LendingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [lending, setLending] = useState<Lending | null>(null);
  const [personName, setPersonName] = useState('');
  const [payments, setPayments] = useState<LendingPayment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const l = await lendingRepo.getById(id);
    const p = await lendingPaymentRepo.listByLending(id);
    const a = await accountRepo.list();
    if (l) {
      const person = await lendingPersonRepo.getById(l.personId);
      setPersonName(person?.name ?? 'Unknown');
    }
    setLending(l);
    setPayments(p);
    setAccounts(a);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  async function handleDelete() {
    if (!lending) return;
    await lendingRepo.softDelete(lending.id);
    router.back();
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={theme.colors.accentPrimary} size="large" />
      </View>
    );
  }

  if (!lending) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <AppText variant="body" color="textMuted">Lending not found.</AppText>
      </View>
    );
  }

  const statusColor = lending.status === 'Paid' ? 'positive' : 'accentPrimary';

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
        <AppText variant="h2" style={styles.flex}>Lending Detail</AppText>
        <Pressable
          onPress={() => setEditVisible(true)}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Edit lending"
        >
          <Feather name="edit-2" size={18} color={theme.colors.accentPrimary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <AppText variant="h3" style={styles.flex}>{personName}</AppText>
            <AppText variant="labelLg" color={statusColor}>{lending.status}</AppText>
          </View>
          {lending.status === 'Paid' ? (
            <>
              <Amount value={totalPaid} variant="amountLg" semanticColor={false} color="positive" />
              <AppText variant="bodySm" color="textMuted" style={styles.originalLabel}>
                Fully paid back • {formatPHP(lending.amount)} lent
              </AppText>
            </>
          ) : (
            <>
              <Amount value={lending.outstandingBalance} variant="amountLg" semanticColor={false} />
              <AppText variant="bodySm" color="textMuted" style={styles.originalLabel}>
                of {formatPHP(lending.amount)} lent
              </AppText>
            </>
          )}
          <View style={styles.metaRow}>
            <Feather name="calendar" size={14} color={theme.colors.textMuted} />
            <AppText variant="bodySm" color="textMuted">Lent {displayDate(lending.date)}</AppText>
          </View>
          {lending.note ? (
            <AppText variant="bodySm" color="textMuted" style={styles.note}>{lending.note}</AppText>
          ) : null}
        </Card>

        {lending.status !== 'Paid' && (
          <View style={styles.actions}>
            <Button
              label="Add Payment"
              onPress={() => setPaymentVisible(true)}
              style={styles.flex}
            />
          </View>
        )}

        <AppText variant="h3" style={styles.sectionTitle}>Payment History</AppText>

        {payments.length === 0 ? (
          <EmptyState icon="dollar-sign" title="No payments yet" subtitle="Record a payback above" />
        ) : (
          payments.map((p) => (
            <View key={p.id} style={styles.paymentRow}>
              <View style={styles.paymentIconCircle}>
                <Feather name="dollar-sign" size={18} color={theme.colors.positive} />
              </View>
              <View style={styles.paymentInfo}>
                <AppText variant="body">{displayDate(p.date)}</AppText>
                <AppText variant="bodySm" color="textMuted">
                  to {accountMap[p.accountId] ?? 'Unknown account'}
                </AppText>
              </View>
              <Amount value={p.amount} variant="amountSm" color="positive" semanticColor={false} />
            </View>
          ))
        )}

        <Pressable
          onPress={() => setDeleteVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Delete lending"
          style={styles.deleteBtn}
        >
          <Feather name="trash-2" size={16} color={theme.colors.negative} />
          <AppText variant="body" color="negative">Delete Lending</AppText>
        </Pressable>
      </ScrollView>

      <AddLendingSheet
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        onSuccess={load}
        initial={lending}
      />

      <AddLendingPaymentSheet
        visible={paymentVisible}
        onClose={() => setPaymentVisible(false)}
        onSuccess={load}
        lendingId={lending.id}
        personName={personName}
        outstandingBalance={lending.outstandingBalance}
      />

      <ConfirmDialog
        visible={deleteVisible}
        title="Delete Lending"
        message={`Delete lending to "${personName}"? This cannot be undone.`}
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
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[5],
    marginTop: theme.spacing[3],
  },
});
