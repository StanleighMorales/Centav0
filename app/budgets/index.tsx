import React, { useState, useCallback } from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FAB } from '../../src/components/ui/FAB';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { AddBudgetSheet } from '../../src/components/budgets/AddBudgetSheet';
import { allocationRepo, categoryRepo } from '../../src/repositories';
import { formatPHP } from '../../src/utils/currency';
import { theme } from '../../src/theme';
import type { Allocation, Category, AllocationProgress } from '../../src/domain/types';

type BudgetRow = {
  allocation: Allocation;
  category: Category | null;
  progress: AllocationProgress;
};

function ProgressBar({ percent }: { percent: number }) {
  const fill = percent >= 100
    ? theme.colors.negative
    : percent >= 80
    ? theme.colors.warning
    : theme.colors.accentPrimary;
  return (
    <View style={barStyles.track}>
      <View style={[barStyles.fill, { width: `${Math.min(percent, 100)}%` as any, backgroundColor: fill }]} />
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: {
    height: 4,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: theme.radius.full },
});

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Allocation | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Allocation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const allocations = await allocationRepo.list();
    const categories = await categoryRepo.list();
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const budgetRows: BudgetRow[] = [];
    for (const a of allocations.filter((a) => a.categoryId !== null)) {
      budgetRows.push({
        allocation: a,
        category: catMap.get(a.categoryId!) ?? null,
        progress: await allocationRepo.getProgress(a.id),
      });
    }
    setRows(budgetRows);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openAdd() { setEditTarget(undefined); setSheetVisible(true); }
  function openEdit(allocation: Allocation) { setEditTarget(allocation); setSheetVisible(true); }

  async function handleDelete() {
    if (!deleteTarget) return;
    await allocationRepo.softDelete(deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppText variant="h2" style={styles.title}>Budgets</AppText>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.allocation.id}
        contentContainerStyle={[
          styles.list,
          rows.length === 0 && styles.listEmpty,
          { paddingBottom: 80 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState icon="pie-chart" title="No budgets yet" subtitle="Tap + to set a spending limit" />
          )
        }
        renderItem={({ item }) => {
          const { allocation, category, progress } = item;
          const overBudget = progress.percent >= 100;
          return (
            <Pressable
              onPress={() => openEdit(allocation)}
              onLongPress={() => setDeleteTarget(allocation)}
              accessibilityLabel={`${category?.name ?? 'Budget'}, ${Math.round(progress.percent)}% used`}
              accessibilityRole="button"
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardLeft}>
                  <AppText variant="h4">{category?.name ?? '—'}</AppText>
                  <AppText variant="bodySm" color="textSecondary">{allocation.period}</AppText>
                </View>
                <Feather name="edit-2" size={16} color={theme.colors.textMuted} />
              </View>
              <View style={styles.amountRow}>
                <AppText variant="amountSm" color={overBudget ? 'negative' : 'textPrimary'}>
                  {formatPHP(progress.spent)}
                </AppText>
                <AppText variant="amountSm" color="textSecondary">
                  {' / '}{formatPHP(progress.allocated)}
                </AppText>
              </View>
              <ProgressBar percent={progress.percent} />
              <View style={styles.remainRow}>
                <AppText variant="bodySm" color={overBudget ? 'negative' : 'textSecondary'}>
                  {overBudget
                    ? `Over by ${formatPHP(progress.spent - progress.allocated)}`
                    : `${formatPHP(progress.remaining)} remaining`}
                </AppText>
                <AppText variant="labelSm" color={overBudget ? 'negative' : 'textMuted'}>
                  {Math.round(progress.percent)}%
                </AppText>
              </View>
            </Pressable>
          );
        }}
      />
      <FAB onPress={openAdd} accessibilityLabel="Add budget" />
      <AddBudgetSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSuccess={load}
        initial={editTarget}
      />
      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete Budget"
        message="Remove this budget? Your transactions are not affected."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
    paddingHorizontal: theme.spacing[5],
  },
  title: { marginTop: theme.spacing[7], marginBottom: theme.spacing[5] },
  list: { gap: theme.spacing[4] },
  listEmpty: { flex: 1, justifyContent: 'center' },
  card: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
    gap: theme.spacing[3],
    ...theme.shadows.sm,
  },
  cardPressed: { opacity: 0.85 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardLeft: { gap: theme.spacing[1] },
  amountRow: { flexDirection: 'row', alignItems: 'baseline' },
  remainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
