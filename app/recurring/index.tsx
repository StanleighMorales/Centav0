import React, { useState, useCallback } from 'react';
import { View, FlatList, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { AppText } from '../../src/components/ui/AppText';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FAB } from '../../src/components/ui/FAB';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { AddRecurringSheet } from '../../src/components/recurring/AddRecurringSheet';
import { recurringTransactionRepo, accountRepo, categoryRepo } from '../../src/repositories';
import { formatPHP } from '../../src/utils/currency';
import { displayDate } from '../../src/utils/date';
import { theme, makeStyles } from '../../src/theme';
import type { RecurringTransaction, Account, Category } from '../../src/domain/types';

const FREQUENCY_LABEL: Record<RecurringTransaction['frequency'], string> = {
  monthly: 'Monthly',
  'semi-monthly': 'Semi-monthly',
  weekly: 'Weekly',
};

export default function RecurringScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [rules, setRules] = useState<RecurringTransaction[]>([]);
  const [accounts, setAccounts] = useState<Record<string, Account>>({});
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<RecurringTransaction | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<RecurringTransaction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [list, allAccounts, expenseCats, incomeCats] = await Promise.all([
      recurringTransactionRepo.list(), accountRepo.list(),
      categoryRepo.list('Expense'), categoryRepo.list('Income'),
    ]);
    setRules(list);
    setAccounts(Object.fromEntries(allAccounts.map((a) => [a.id, a])));
    setCategories(Object.fromEntries([...expenseCats, ...incomeCats].map((c) => [c.id, c])));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openAdd() { setEditTarget(undefined); setSheetVisible(true); }
  function openEdit(rule: RecurringTransaction) { setEditTarget(rule); setSheetVisible(true); }

  async function handleDelete() {
    if (!deleteTarget) return;
    await recurringTransactionRepo.softDelete(deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppText variant="h2" style={styles.title}>Recurring</AppText>
      <FlatList
        data={rules}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          rules.length === 0 && styles.listEmpty,
          { paddingBottom: 80 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState icon="repeat" title="No recurring transactions" subtitle="Tap + to add salary, rent, or a subscription" />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openEdit(item)}
            onLongPress={() => setDeleteTarget(item)}
            accessibilityLabel={`${item.note ?? categories[item.categoryId ?? '']?.name ?? item.type}, ${formatPHP(item.amount)}`}
            accessibilityRole="button"
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardLeft}>
                <AppText variant="h4">{item.note || categories[item.categoryId ?? '']?.name || item.type}</AppText>
                <AppText variant="bodySm" color="textSecondary">
                  {FREQUENCY_LABEL[item.frequency]} · {accounts[item.accountId]?.name ?? '—'}
                </AppText>
              </View>
              <AppText variant="amountSm" color={item.type === 'Income' ? 'positive' : 'textPrimary'}>
                {formatPHP(item.amount)}
              </AppText>
            </View>
            <AppText variant="bodySm" color="textMuted">
              {item.lastMaterializedDate
                ? `Last posted ${displayDate(item.lastMaterializedDate)}`
                : `Starts ${displayDate(item.startDate)}`}
            </AppText>
          </Pressable>
        )}
      />
      <FAB onPress={openAdd} accessibilityLabel="Add recurring transaction" />
      <AddRecurringSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSuccess={load}
        initial={editTarget}
      />
      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete Recurring"
        message="Stop future occurrences? Transactions already posted are not affected."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        destructive
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: {
    flex: 1,
    backgroundColor: c.bgPrimary,
    paddingHorizontal: theme.spacing[5],
  },
  title: { marginTop: theme.spacing[7], marginBottom: theme.spacing[5] },
  list: { gap: theme.spacing[4] },
  listEmpty: { flex: 1, justifyContent: 'center' },
  card: {
    backgroundColor: c.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
    gap: theme.spacing[2],
    ...theme.shadows.sm,
  },
  cardPressed: { opacity: 0.85 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardLeft: { gap: theme.spacing[1] },
}));
