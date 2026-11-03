import React from 'react';
import { View, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../ui/AppText';
import { Amount } from '../ui/Amount';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { displayDate } from '../../utils/date';
import { formatPHP } from '../../utils/currency';
import { STATUS_COLOR, STATUS_LABEL, type Statement, type summarize } from '../../utils/creditStatements';
import { theme, makeStyles, useTheme } from '../../theme';

type Props = {
  statements: Statement[];
  summary: ReturnType<typeof summarize>;
  earlierAmount: number;
  earlierMonths: number | null;
  earlierFirstBill: string | null;
  onChangeEarlier: () => void;
};

// A credit line's bills: what's due now, then every statement, past and upcoming, with its status.
export function CreditStatementsView({ statements, summary, earlierAmount, earlierMonths, earlierFirstBill, onChangeEarlier }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { overdue, dueNow, current, next } = summary;

  return (
    <>
      <Card style={styles.billCard}>
        <AppText variant="labelSm" color="textMuted">THIS BILL</AppText>
        {overdue > 0 ? (
          <>
            <Amount value={overdue} variant="amountMd" semanticColor={false} color="negative" />
            <View style={styles.iconRow}>
              <Feather name="alert-circle" size={14} color={colors.negative} />
              <AppText variant="bodySm" color="negative">Overdue · pay as soon as you can</AppText>
            </View>
          </>
        ) : dueNow > 0 && current ? (
          <>
            <Amount value={dueNow} variant="amountMd" semanticColor={false} color={STATUS_COLOR[current.status]} />
            <AppText variant="bodySm" color={STATUS_COLOR[current.status]}>
              {STATUS_LABEL[current.status]} · {displayDate(current.dueDate)}
            </AppText>
          </>
        ) : current ? (
          <View style={styles.iconRow}>
            <Feather name="check-circle" size={16} color={colors.positive} />
            <AppText variant="body" color="positive">Paid for {displayDate(current.dueDate)}</AppText>
          </View>
        ) : (
          <AppText variant="body" color="textMuted">Nothing billed yet</AppText>
        )}
        {next ? (
          <AppText variant="bodySm" color="textMuted">
            Next bill {displayDate(next.billDate)} · {formatPHP(next.remaining)} so far
          </AppText>
        ) : null}
      </Card>

      {earlierAmount > 0 ? (
        <Pressable
          onPress={onChangeEarlier}
          accessibilityRole="button"
          accessibilityLabel="Change how the earlier balance is split"
          style={({ pressed }) => [styles.earlier, pressed && styles.pressed]}
        >
          <View style={styles.flex}>
            <AppText variant="body">Earlier balance · {formatPHP(earlierAmount)}</AppText>
            <AppText variant="bodySm" color="textMuted">
              {earlierMonths
                ? `${earlierMonths} ${earlierMonths === 1 ? 'month' : 'months'} from ${earlierFirstBill ? displayDate(earlierFirstBill) : 'the next bill'}`
                : 'Owed beyond your recorded purchases · set months left'}
            </AppText>
          </View>
          <AppText variant="labelLg" color="accentPrimary">Change</AppText>
        </Pressable>
      ) : null}

      <AppText variant="h3">Repayments</AppText>
      {statements.length === 0 ? (
        <EmptyState icon="calendar" title="No bills yet" subtitle="Purchases on this credit line show up here by month" />
      ) : (
        statements.map((s) => (
          <View key={s.billDate} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: colors[STATUS_COLOR[s.status]] }]} />
            <View style={styles.flex}>
              <AppText variant="body">Due {displayDate(s.dueDate)}</AppText>
              <AppText variant="bodySm" color="textMuted">
                Billed {displayDate(s.billDate)}
                {s.paid > 0 && s.remaining > 0 ? ` · ${formatPHP(s.paid)} paid, ${formatPHP(s.remaining)} left` : ''}
              </AppText>
            </View>
            <View style={styles.trail}>
              <Amount
                value={s.amount}
                variant="amountSm"
                semanticColor={false}
                color={s.status === 'upcoming' ? 'textSecondary' : 'textPrimary'}
              />
              <AppText variant="labelSm" color={STATUS_COLOR[s.status]}>{STATUS_LABEL[s.status]}</AppText>
            </View>
          </View>
        ))
      )}
    </>
  );
}

const useStyles = makeStyles((c) => ({
  billCard: { gap: theme.spacing[2] },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  earlier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    padding: theme.spacing[4],
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: c.borderDefault,
    backgroundColor: c.bgSurface,
  },
  pressed: { opacity: 0.6 },
  flex: { flex: 1, gap: theme.spacing[1] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: c.borderDefault,
  },
  dot: { width: 8, height: 8, borderRadius: theme.radius.full },
  trail: { alignItems: 'flex-end', gap: theme.spacing[1] },
}));
