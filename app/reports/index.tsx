import React, { useState, useCallback } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { DatePicker } from '../../src/components/ui/DatePicker';
import { transactionRepo, categoryRepo, debtPaymentRepo } from '../../src/repositories';
import { formatPHP } from '../../src/utils/currency';
import { endOfDayManilaIso, periodRangeIso, startOfDayManilaIso, type Period } from '../../src/utils/date';
import { theme } from '../../src/theme';
import type { Category } from '../../src/domain/types';

type CategoryRow = { categoryId: string; name: string; total: number; percent: number };
type ReportPeriod = Period | 'custom';

const periods: { key: ReportPeriod; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'custom', label: 'Custom' },
];

function dateLabel(date: Date, options: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString('en-PH', { ...options, timeZone: 'Asia/Manila' });
}

function customRange(startIso: string, endIso: string): { from: string; to: string } {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const [fromDate, toDate] = start <= end ? [start, end] : [end, start];
  return { from: startOfDayManilaIso(fromDate), to: endOfDayManilaIso(toDate) };
}

function customLabel(startIso: string, endIso: string): string {
  const { from, to } = customRange(startIso, endIso);
  return `${dateLabel(new Date(from), { month: 'short', day: 'numeric' })} - ${dateLabel(new Date(to), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

function periodLabel(period: ReportPeriod, date: Date, customStart: string, customEnd: string): string {
  if (period === 'custom') {
    return customLabel(customStart, customEnd);
  }
  if (period === 'day') {
    return dateLabel(date, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (period === 'week') {
    const { from, to } = periodRangeIso(period, date);
    return `${dateLabel(new Date(from), { month: 'short', day: 'numeric' })} - ${dateLabel(new Date(to), {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  }
  if (period === 'year') {
    return dateLabel(date, { year: 'numeric' });
  }
  return date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' });
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [customStart, setCustomStart] = useState(startOfDayManilaIso());
  const [customEnd, setCustomEnd] = useState(endOfDayManilaIso());
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [breakdown, setBreakdown] = useState<CategoryRow[]>([]);

  const referenceDate = useCallback(() => {
    const d = new Date();
    if (period === 'day') d.setDate(d.getDate() + periodOffset);
    if (period === 'week') d.setDate(d.getDate() + periodOffset * 7);
    if (period === 'month') d.setMonth(d.getMonth() + periodOffset);
    if (period === 'year') d.setFullYear(d.getFullYear() + periodOffset);
    return d;
  }, [period, periodOffset]);

  const load = useCallback(async () => {
    const { from, to } = period === 'custom'
      ? customRange(customStart, customEnd)
      : periodRangeIso(period, referenceDate());
    const transactions = await transactionRepo.list({ from, to });
    const debtPayments = await debtPaymentRepo.list({ from, to });
    const categories = await categoryRepo.list();
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
    const debtPaymentTotal = debtPayments.reduce((sum, p) => sum + p.amount, 0);
    exp += debtPaymentTotal;
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
    if (debtPaymentTotal > 0) {
      rows.push({
        categoryId: 'debt-payments',
        name: 'Debt Payments',
        total: debtPaymentTotal,
        percent: exp > 0 ? (debtPaymentTotal / exp) * 100 : 0,
      });
    }
    rows.sort((a, b) => b.total - a.total);
    setBreakdown(rows);
  }, [customEnd, customStart, period, referenceDate]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const net = income - expense;
  const refDate = referenceDate();
  const canPage = period !== 'custom';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppText variant="h2" style={styles.title}>Reports</AppText>

      <View style={styles.periodNav}>
        <Pressable
          onPress={() => setPeriodOffset((o) => o - 1)}
          disabled={!canPage}
          accessibilityRole="button"
          accessibilityLabel={`Previous ${period}`}
          hitSlop={12}
          style={{ opacity: canPage ? 1 : 0 }}
        >
          <Feather name="chevron-left" size={22} color={theme.colors.textSecondary} />
        </Pressable>
        <View style={styles.periodTitle}>
          <AppText variant="h4" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.periodTitleText}>
            {periodLabel(period, refDate, customStart, customEnd)}
          </AppText>
        </View>
        <Pressable
          onPress={() => setPeriodOffset((o) => Math.min(0, o + 1))}
          disabled={!canPage}
          accessibilityRole="button"
          accessibilityLabel={`Next ${period}`}
          hitSlop={12}
          style={{ opacity: canPage ? (periodOffset >= 0 ? 0.3 : 1) : 0 }}
        >
          <Feather name="chevron-right" size={22} color={theme.colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.periodTabs}>
        {periods.map((item) => {
          const selected = item.key === period;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                setPeriod(item.key);
                setPeriodOffset(0);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.periodTab, selected && styles.periodTabSelected]}
            >
              <AppText
                variant="labelSm"
                color={selected ? 'bgPrimary' : 'textSecondary'}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={styles.periodTabText}
              >
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {period === 'custom' && (
        <View style={styles.customDates}>
          <DatePicker label="From" value={customStart} onChange={setCustomStart} />
          <DatePicker label="To" value={customEnd} onChange={setCustomEnd} />
        </View>
      )}

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
              No transactions this {period === 'custom' ? 'range' : period}
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
  periodNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[3],
  },
  periodTitle: { flex: 1, alignItems: 'center', paddingHorizontal: theme.spacing[3] },
  periodTitleText: { width: '100%', textAlign: 'center' },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.md,
    padding: 3,
    marginBottom: theme.spacing[5],
  },
  periodTab: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
  },
  periodTabText: { width: '100%', textAlign: 'center' },
  periodTabSelected: {
    backgroundColor: theme.colors.accentPrimary,
  },
  customDates: {
    gap: theme.spacing[3],
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
