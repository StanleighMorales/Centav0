import React, { useState, useCallback } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { transactionRepo, categoryRepo } from '../../src/repositories';
import { formatPHP } from '../../src/utils/currency';
import { monthRangeIso } from '../../src/utils/date';
import { theme } from '../../src/theme';
import type { Category } from '../../src/domain/types';

type CategoryRow = { categoryId: string; name: string; total: number; percent: number };

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' });
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const [monthOffset, setMonthOffset] = useState(0);
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [breakdown, setBreakdown] = useState<CategoryRow[]>([]);

  const referenceDate = useCallback(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const load = useCallback(async () => {
    const { from, to } = monthRangeIso(referenceDate());
    const [transactions, categories] = await Promise.all([
      transactionRepo.list({ from, to }),
      categoryRepo.list(),
    ]);
    const catMap = new Map<string, Category>(categories.map((c) => [c.id, c]));

    let inc = 0, exp = 0;
    const catTotals = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type === 'Income') { inc += tx.amount; }
      else {
        exp += tx.amount;
        catTotals.set(tx.categoryId, (catTotals.get(tx.categoryId) ?? 0) + tx.amount);
      }
    }
    setIncome(inc);
    setExpense(exp);

    const rows: CategoryRow[] = [];
    catTotals.forEach((total, catId) => {
      rows.push({
        categoryId: catId,
        name: catMap.get(catId)?.name ?? 'Uncategorized',
        total,
        percent: exp > 0 ? (total / exp) * 100 : 0,
      });
    });
    rows.sort((a, b) => b.total - a.total);
    setBreakdown(rows);
  }, [referenceDate]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const net = income - expense;
  const refDate = referenceDate();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppText variant="h2" style={styles.title}>Reports</AppText>

      <View style={styles.monthNav}>
        <Pressable
          onPress={() => setMonthOffset((o) => o - 1)}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={12}
        >
          <Feather name="chevron-left" size={22} color={theme.colors.textSecondary} />
        </Pressable>
        <AppText variant="h4">{monthLabel(refDate)}</AppText>
        <Pressable
          onPress={() => setMonthOffset((o) => Math.min(0, o + 1))}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={12}
          style={{ opacity: monthOffset >= 0 ? 0.3 : 1 }}
        >
          <Feather name="chevron-right" size={22} color={theme.colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryCol}>
            <AppText variant="labelSm" color="textMuted" style={styles.summaryLabel}>INCOME</AppText>
            <AppText variant="amountMd" color="positive">{formatPHP(income)}</AppText>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <AppText variant="labelSm" color="textMuted" style={styles.summaryLabel}>EXPENSE</AppText>
            <AppText variant="amountMd" color="negative">{formatPHP(expense)}</AppText>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <AppText variant="labelSm" color="textMuted" style={styles.summaryLabel}>NET</AppText>
            <AppText variant="amountMd" color={net >= 0 ? 'positive' : 'negative'}>{formatPHP(net)}</AppText>
          </View>
        </View>

        {breakdown.length > 0 && (
          <View style={styles.section}>
            <AppText variant="labelSm" color="textMuted" style={styles.sectionLabel}>EXPENSES BY CATEGORY</AppText>
            {breakdown.map((row) => (
              <View key={row.categoryId} style={styles.catRow}>
                <View style={styles.catHeader}>
                  <AppText variant="bodySm">{row.name}</AppText>
                  <View style={styles.catAmounts}>
                    <AppText variant="amountXs" color="textSecondary">
                      {Math.round(row.percent)}%
                    </AppText>
                    <AppText variant="amountSm" color="negative">{formatPHP(row.total)}</AppText>
                  </View>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${row.percent}%` as any }]} />
                </View>
              </View>
            ))}
          </View>
        )}

        {breakdown.length === 0 && (
          <View style={styles.empty}>
            <Feather name="bar-chart-2" size={40} color={theme.colors.textMuted} />
            <AppText variant="bodySm" color="textMuted" style={styles.emptyText}>
              No transactions this month
            </AppText>
          </View>
        )}
      </ScrollView>
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
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[5],
  },
  scroll: { gap: theme.spacing[5] },
  summaryCard: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
    flexDirection: 'row',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  summaryCol: { flex: 1, alignItems: 'center', gap: theme.spacing[2] },
  summaryLabel: { letterSpacing: 0.8 },
  summaryDivider: { width: 1, height: 40, backgroundColor: theme.colors.borderDefault },
  section: { gap: theme.spacing[4] },
  sectionLabel: { letterSpacing: 0.8 },
  catRow: { gap: theme.spacing[2] },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catAmounts: { flexDirection: 'row', gap: theme.spacing[4], alignItems: 'center' },
  barTrack: {
    height: 4,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    backgroundColor: theme.colors.accentPrimary,
    borderRadius: theme.radius.full,
  },
  empty: { alignItems: 'center', gap: theme.spacing[4], paddingTop: theme.spacing[10] },
  emptyText: { textAlign: 'center' },
});
