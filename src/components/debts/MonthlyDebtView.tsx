import React, { useState, useEffect, useCallback } from 'react';
import { View, Pressable, TextInput } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../ui/AppText';
import { Amount } from '../ui/Amount';
import { EmptyState } from '../ui/EmptyState';
import { theme, makeStyles, useTheme } from '../../theme';
import { displayDate } from '../../utils/date';
import { formatPHP } from '../../utils/currency';
import { spendableAccounts } from '../../utils/accumulated';
import { stillNeeded } from '../../utils/debtCoverage';
import { duesInMonth, type DueRow } from '../../utils/installmentSchedule';
import { getSetting, setSetting } from '../../repositories/settings';
import type { Account, Debt } from '../../domain/types';

type Props = { debts: Debt[]; accounts: Account[] };

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' });
}

type DueTag = { label: string; color: 'negative' | 'warning' | 'textMuted'; icon: keyof typeof Feather.glyphMap };

function dueTag(iso: string): DueTag {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / 86_400_000);
  if (days < 0) return { label: `Overdue ${-days}d`, color: 'negative', icon: 'alert-circle' };
  if (days === 0) return { label: 'Due today', color: 'warning', icon: 'clock' };
  return { label: days === 1 ? 'Tomorrow' : `In ${days} days`, color: 'textMuted', icon: 'calendar' };
}

export function MonthlyDebtView({ debts, accounts }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [expectedIncome, setExpectedIncome] = useState(0);
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState('');

  const key = monthKey(selectedMonth);

  const loadIncome = useCallback(async () => {
    const raw = await getSetting(`expectedIncome:${key}`);
    setExpectedIncome(raw ? Number(raw) : 0);
  }, [key]);

  useEffect(() => { loadIncome(); }, [loadIncome]);
  useFocusEffect(useCallback(() => { loadIncome(); }, [loadIncome]));

  function shiftMonth(delta: number) {
    setEditingIncome(false);
    setSelectedMonth((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  async function saveIncome() {
    const value = Math.max(0, parseFloat(incomeInput) || 0);
    setExpectedIncome(value);
    setEditingIncome(false);
    await setSetting(`expectedIncome:${key}`, String(value));
  }

  const rows: DueRow[] = duesInMonth(debts, selectedMonth);

  const groups = Object.values(
    rows.reduce<Record<string, DueRow[]>>((acc, r) => {
      (acc[r.dueDate] ??= []).push(r);
      return acc;
    }, {}),
  ).sort((a, b) => a[0].dueDate.localeCompare(b[0].dueDate));

  const totalDue = rows.reduce((sum, r) => sum + r.amount, 0);
  const availableFunds = spendableAccounts(accounts).reduce((sum, a) => sum + a.currentBalance, 0);
  const stillNeededAmount = stillNeeded(totalDue, availableFunds, expectedIncome);

  return (
    <View style={styles.container}>
      <View style={styles.nav}>
        <Pressable
          onPress={() => shiftMonth(-1)}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={12}
        >
          <Feather name="chevron-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <AppText variant="h3">{monthLabel(selectedMonth)}</AppText>
        <Pressable
          onPress={() => shiftMonth(1)}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={12}
        >
          <Feather name="chevron-right" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <AppText variant="bodySm" color="textMuted">Total Due</AppText>
          <Amount value={totalDue} variant="amountSm" semanticColor={false} />
        </View>
        <View style={styles.summaryRow}>
          <AppText variant="bodySm" color="textMuted">Available Funds</AppText>
          <Amount value={availableFunds} variant="amountSm" semanticColor={false} />
        </View>
        <Pressable
          style={styles.summaryRow}
          onPress={() => { setIncomeInput(expectedIncome > 0 ? String(expectedIncome) : ''); setEditingIncome(true); }}
          accessibilityRole="button"
          accessibilityLabel="Edit expected income"
        >
          <AppText variant="bodySm" color="textMuted">Expected Income</AppText>
          {editingIncome ? (
            <TextInput
              value={incomeInput}
              onChangeText={setIncomeInput}
              onBlur={saveIncome}
              onSubmitEditing={saveIncome}
              keyboardType="decimal-pad"
              autoFocus
              style={styles.incomeInput}
            />
          ) : (
            <Amount value={expectedIncome} variant="amountSm" semanticColor={false} color="accentPrimary" />
          )}
        </Pressable>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <AppText variant="labelLg">Still Needed</AppText>
          <Amount
            value={stillNeededAmount}
            variant="amountMd"
            semanticColor={false}
            color={stillNeededAmount > 0 ? 'negative' : 'positive'}
          />
        </View>
      </View>

      {groups.length === 0 ? (
        <EmptyState icon="calendar" title={`No debts due in ${monthLabel(selectedMonth)}`} />
      ) : (
        groups.map((group) => {
          const subtotal = group.reduce((sum, r) => sum + r.amount, 0);
          const tag = dueTag(group[0].dueDate);
          return (
            <View key={group[0].dueDate} style={styles.group}>
              <View style={styles.groupHeader}>
                <AppText variant="labelLg">{displayDate(group[0].dueDate)}</AppText>
                <View style={styles.tag}>
                  <Feather name={tag.icon} size={12} color={colors[tag.color]} />
                  <AppText variant="labelSm" color={tag.color}>{tag.label}</AppText>
                </View>
              </View>
              {group.map((row) => (
                <Pressable
                  key={row.debt.id}
                  onPress={() => router.push(`/debts/${row.debt.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`View debt from ${row.debt.creditor}, ${formatPHP(row.amount)} due`}
                  style={styles.debtRow}
                >
                  <View style={styles.debtInfo}>
                    <AppText variant="body" numberOfLines={1}>{row.debt.creditor}</AppText>
                    <AppText variant="labelSm" color="textMuted">{row.debt.debtType}</AppText>
                  </View>
                  <Amount value={row.amount} variant="amountSm" semanticColor={false} />
                  <Feather name="chevron-right" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
              {group.length > 1 ? (
                <View style={styles.subtotalRow}>
                  <AppText variant="bodySm" color="textMuted">Day total</AppText>
                  <AppText variant="amountXs" color="textSecondary">{formatPHP(subtotal)}</AppText>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { paddingHorizontal: theme.spacing[5] },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[4],
  },
  summary: {
    backgroundColor: c.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
    gap: theme.spacing[3],
    marginBottom: theme.spacing[4],
    ...theme.shadows.sm,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryDivider: { height: 1, backgroundColor: c.borderDefault },
  incomeInput: {
    ...theme.typography.amountSm,
    color: c.accentPrimary,
    minWidth: 80,
    textAlign: 'right',
    padding: 0,
  },
  group: {
    backgroundColor: c.bgSurface,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing[3],
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[3],
    backgroundColor: c.bgElevated,
  },
  tag: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    minHeight: 56,
    paddingHorizontal: theme.spacing[5],
    borderTopWidth: 1,
    borderTopColor: c.borderDefault,
  },
  debtInfo: { flex: 1 },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[3],
    borderTopWidth: 1,
    borderTopColor: c.borderStrong,
  },
}));
