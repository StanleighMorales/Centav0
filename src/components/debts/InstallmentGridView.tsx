import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../ui/AppText';
import { Amount } from '../ui/Amount';
import { EmptyState } from '../ui/EmptyState';
import { BottomSheet } from '../ui/BottomSheet';
import { theme } from '../../theme';
import { displayDate } from '../../utils/date';
import { formatPHP } from '../../utils/currency';
import { spendableAccounts } from '../../utils/accumulated';
import { stillNeeded } from '../../utils/debtCoverage';
import { buildSchedule, wholeLoanTotal, type ScheduleMonth } from '../../utils/installmentSchedule';
import { getSetting, setSetting } from '../../repositories/settings';
import type { Account, Debt } from '../../domain/types';

type Props = { debts: Debt[]; accounts: Account[] };

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CELL_WIDTH = 84;
const NAME_WIDTH = 140;
const TOTAL_WIDTH = 96;

type LoanRow = { debt: Debt; schedule: ScheduleMonth[] };

function statusColor(status: ScheduleMonth['status']): keyof typeof theme.colors {
  if (status === 'paid') return 'textMuted';
  if (status === 'due') return 'accentPrimary';
  return 'textPrimary';
}

export function InstallmentGridView({ debts, accounts }: Props) {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [detailCell, setDetailCell] = useState<{ debt: Debt; month: ScheduleMonth } | null>(null);
  const [expectedIncome, setExpectedIncome] = useState(0);
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState('');

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const loadIncome = useCallback(async () => {
    const raw = await getSetting(`expectedIncome:${currentMonthKey}`);
    setExpectedIncome(raw ? Number(raw) : 0);
  }, [currentMonthKey]);

  useEffect(() => { loadIncome(); }, [loadIncome]);
  useFocusEffect(useCallback(() => { loadIncome(); }, [loadIncome]));

  async function saveIncome() {
    const value = Math.max(0, parseFloat(incomeInput) || 0);
    setExpectedIncome(value);
    setEditingIncome(false);
    await setSetting(`expectedIncome:${currentMonthKey}`, String(value));
  }

  const rows: LoanRow[] = debts
    .filter((d) => d.debtType === 'Loan' && d.isInstallment && d.termMonths)
    .map((debt) => ({ debt, schedule: buildSchedule(debt) }))
    .filter((row) => row.schedule.some((m) => new Date(m.dueDate).getFullYear() === selectedYear));

  // Only what's still unpaid counts toward what the user still owes this month —
  // a cell already marked 'paid' shouldn't keep inflating "Due This Month".
  const currentMonthTotal = rows.reduce((sum, row) => {
    const monthCell = row.schedule.find((m) => {
      const d = new Date(m.dueDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    return sum + (monthCell && monthCell.status !== 'paid' ? monthCell.amount : 0);
  }, 0);
  const availableFunds = spendableAccounts(accounts).reduce((sum, a) => sum + a.currentBalance, 0);
  const stillNeededAmount = stillNeeded(currentMonthTotal, availableFunds, expectedIncome);

  return (
    <View style={styles.container}>
      <View style={styles.nav}>
        <Pressable
          onPress={() => setSelectedYear((y) => y - 1)}
          accessibilityRole="button"
          accessibilityLabel="Previous year"
          hitSlop={12}
        >
          <Feather name="chevron-left" size={22} color={theme.colors.textPrimary} />
        </Pressable>
        <AppText variant="h3">{selectedYear}</AppText>
        <Pressable
          onPress={() => setSelectedYear((y) => y + 1)}
          accessibilityRole="button"
          accessibilityLabel="Next year"
          hitSlop={12}
        >
          <Feather name="chevron-right" size={22} color={theme.colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <AppText variant="bodySm" color="textMuted">Due This Month</AppText>
          <Amount value={currentMonthTotal} variant="amountSm" semanticColor={false} />
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

      {rows.length === 0 ? (
        <EmptyState icon="grid" title={`No installment loans scheduled in ${selectedYear}`} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.headerRow}>
              <View style={[styles.nameCell, { width: NAME_WIDTH }]} />
              {MONTH_LABELS.map((label) => (
                <View key={label} style={[styles.monthCell, { width: CELL_WIDTH }]}>
                  <AppText variant="labelSm" color="textMuted">{label}</AppText>
                </View>
              ))}
              <View style={[styles.monthCell, { width: TOTAL_WIDTH }]}>
                <AppText variant="labelSm" color="textMuted">Total</AppText>
              </View>
            </View>

            {rows.map(({ debt, schedule }) => (
              <View key={debt.id} style={styles.row}>
                <Pressable
                  style={[styles.nameCell, { width: NAME_WIDTH }]}
                  onPress={() => router.push(`/debts/${debt.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`View debt from ${debt.creditor}`}
                >
                  <AppText variant="body" numberOfLines={1}>{debt.creditor}</AppText>
                </Pressable>
                {MONTH_LABELS.map((_, monthIndex) => {
                  const cell = schedule.find((m) => {
                    const d = new Date(m.dueDate);
                    return d.getFullYear() === selectedYear && d.getMonth() === monthIndex;
                  });
                  return (
                    <Pressable
                      key={monthIndex}
                      style={[styles.monthCell, { width: CELL_WIDTH }]}
                      disabled={!cell}
                      onPress={() => cell && setDetailCell({ debt, month: cell })}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={
                        cell ? `${debt.creditor} ${MONTH_LABELS[monthIndex]} ${formatPHP(cell.amount)}, ${cell.status}` : 'No payment scheduled'
                      }
                    >
                      {cell ? (
                        <>
                          <AppText variant="amountXs" color={statusColor(cell.status)}>
                            {formatPHP(cell.amount)}
                          </AppText>
                          {cell.interest > 0 ? (
                            <AppText variant="labelSm" color="textMuted">
                              incl. {formatPHP(cell.interest)} int
                            </AppText>
                          ) : null}
                        </>
                      ) : (
                        <AppText variant="bodySm" color="textMuted">—</AppText>
                      )}
                    </Pressable>
                  );
                })}
                <View style={[styles.monthCell, { width: TOTAL_WIDTH }]}>
                  <Amount value={wholeLoanTotal(debt)} variant="amountXs" semanticColor={false} />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <BottomSheet
        visible={detailCell !== null}
        onClose={() => setDetailCell(null)}
        title={detailCell ? `${detailCell.debt.creditor} — Month ${detailCell.month.index + 1}` : undefined}
      >
        {detailCell ? (
          <View style={styles.detail}>
            <View style={styles.detailRow}>
              <AppText variant="bodySm" color="textMuted">Due Date</AppText>
              <AppText variant="body">{displayDate(detailCell.month.dueDate)}</AppText>
            </View>
            <View style={styles.detailRow}>
              <AppText variant="bodySm" color="textMuted">Principal</AppText>
              <Amount value={detailCell.month.principal} variant="amountSm" semanticColor={false} />
            </View>
            <View style={styles.detailRow}>
              <AppText variant="bodySm" color="textMuted">Interest</AppText>
              <Amount value={detailCell.month.interest} variant="amountSm" semanticColor={false} />
            </View>
            {detailCell.month.fee > 0 ? (
              <View style={styles.detailRow}>
                <AppText variant="bodySm" color="textMuted">Fee</AppText>
                <Amount value={detailCell.month.fee} variant="amountSm" semanticColor={false} />
              </View>
            ) : null}
            <View style={styles.summaryDivider} />
            <View style={styles.detailRow}>
              <AppText variant="labelLg">This Month</AppText>
              <Amount value={detailCell.month.amount} variant="amountMd" semanticColor={false} />
            </View>
            <View style={styles.detailRow}>
              <AppText variant="bodySm" color="textMuted">Whole Loan Total</AppText>
              <Amount value={wholeLoanTotal(detailCell.debt)} variant="amountSm" semanticColor={false} />
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: theme.spacing[5] },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[4],
  },
  summary: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
    gap: theme.spacing[3],
    marginBottom: theme.spacing[4],
    ...theme.shadows.sm,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryDivider: { height: 1, backgroundColor: theme.colors.borderDefault },
  incomeInput: {
    ...theme.typography.amountSm,
    color: theme.colors.accentPrimary,
    minWidth: 80,
    textAlign: 'right',
    padding: 0,
  },
  headerRow: { flexDirection: 'row' },
  row: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderDefault,
  },
  nameCell: {
    justifyContent: 'center',
    paddingVertical: theme.spacing[3],
    paddingRight: theme.spacing[3],
  },
  monthCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing[3],
    minHeight: 44,
    gap: theme.spacing[1],
  },
  detail: { gap: theme.spacing[3] },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
