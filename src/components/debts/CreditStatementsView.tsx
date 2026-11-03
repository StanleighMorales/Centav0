import React, { useState } from 'react';
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

type Purchase = { id: string; label: string; date: string };

type Props = {
  statements: Statement[];
  summary: ReturnType<typeof summarize>;
  purchases: Purchase[];
  earlierAmount: number;
  earlierMonths: number | null;
  earlierFirstBill: string | null;
  onChangeEarlier: () => void;
  onEditPurchase: (id: string) => void;
  onDeletePurchase: (id: string) => void;
};

type LineProps = {
  title: string;
  subtitle: string;
  amount: number;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityHint?: string;
};

/** One purchase (or piece of one): tap to edit, hold to delete. */
export function PurchaseLine({ title, subtitle, amount, onPress, onLongPress, accessibilityHint }: LineProps) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}, ${formatPHP(amount)}`}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.line, pressed && styles.pressed]}
    >
      <View style={styles.flex}>
        <AppText variant="body">{title}</AppText>
        <AppText variant="bodySm" color="textMuted">{subtitle}</AppText>
      </View>
      <Amount value={amount} variant="amountSm" semanticColor={false} />
    </Pressable>
  );
}

// A credit line's bills: what's due now, then every bill, past and upcoming. Each bill opens to show the
// purchases (and installment pieces) on it and how much of it is paid.
export function CreditStatementsView({
  statements, summary, purchases, earlierAmount, earlierMonths, earlierFirstBill,
  onChangeEarlier, onEditPurchase, onDeletePurchase,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState<string[]>([]);
  const { overdue, dueNow, current, next } = summary;
  const byId = Object.fromEntries(purchases.map((p) => [p.id, p]));
  const toggle = (key: string) => setOpen((o) => (o.includes(key) ? o.filter((k) => k !== key) : [...o, key]));

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

      <AppText variant="h3">Bills</AppText>
      {statements.length === 0 ? (
        <EmptyState icon="calendar" title="No bills yet" subtitle="Purchases on this credit line show up here on their bill" />
      ) : (
        statements.map((s) => {
          const isOpen = open.includes(s.billDate);
          return (
            <View key={s.billDate}>
              <Pressable
                onPress={() => toggle(s.billDate)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={`Bill due ${displayDate(s.dueDate)}, ${formatPHP(s.amount)}, ${STATUS_LABEL[s.status]}`}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Feather name={isOpen ? 'chevron-down' : 'chevron-right'} size={16} color={colors.textSecondary} />
                <View style={[styles.dot, { backgroundColor: colors[STATUS_COLOR[s.status]] }]} />
                <View style={styles.flex}>
                  <AppText variant="body">Due {displayDate(s.dueDate)}</AppText>
                  <AppText variant="bodySm" color="textMuted">
                    Billed {displayDate(s.billDate)} · {s.pieces.length} {s.pieces.length === 1 ? 'item' : 'items'}
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
              </Pressable>
              {isOpen ? (
                <View style={styles.detail}>
                  {s.pieces.map((piece, i) => {
                    const purchase = piece.chargeId ? byId[piece.chargeId] : undefined;
                    const part = piece.of > 1 ? ` · ${piece.index} of ${piece.of}` : '';
                    return purchase ? (
                      <PurchaseLine
                        key={`${purchase.id}-${piece.index}`}
                        title={purchase.label}
                        subtitle={`Bought ${displayDate(purchase.date)}${part}`}
                        amount={piece.amount}
                        onPress={() => onEditPurchase(purchase.id)}
                        onLongPress={() => onDeletePurchase(purchase.id)}
                        accessibilityHint="Tap to edit, hold to delete"
                      />
                    ) : (
                      <PurchaseLine
                        key={`earlier-${i}`}
                        title="Earlier balance"
                        subtitle={`Owed before your recorded purchases${part}`}
                        amount={piece.amount}
                        onPress={onChangeEarlier}
                      />
                    );
                  })}
                  <AppText variant="bodySm" color={s.remaining > 0 ? 'textSecondary' : 'positive'} style={styles.paidLine}>
                    {s.paid <= 0
                      ? 'Nothing paid yet'
                      : s.remaining > 0
                        ? `Paid ${formatPHP(s.paid)} · ${formatPHP(s.remaining)} left`
                        : `Paid ${formatPHP(s.paid)} in full`}
                  </AppText>
                </View>
              ) : null}
            </View>
          );
        })
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
  // Indented under its bill, lined up with the bill's text rather than its chevron.
  detail: { paddingLeft: theme.spacing[6] },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    paddingVertical: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: c.borderDefault,
  },
  paidLine: { paddingVertical: theme.spacing[3] },
}));
