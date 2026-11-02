import React, { useRef } from 'react';
import { View, Pressable, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { ListItem } from '../ui/ListItem';
import { AppText } from '../ui/AppText';
import { displayDate } from '../../utils/date';
import { formatPHP } from '../../utils/currency';
import { theme, makeStyles, useTheme } from '../../theme';
import type { Transaction } from '../../domain/types';

type Props = {
  transaction: Transaction;
  categoryName: string;
  subtitle?: string;
  toAccountName?: string;
  onEdit: (transaction: Transaction) => void;
  onUndo: (transaction: Transaction) => void;
  onOpenDetail?: (transaction: Transaction) => void;
};

const ACTION_WIDTH = 76;
const ACTIONS_WIDTH = ACTION_WIDTH * 2;

export function TransactionRow({ transaction, categoryName, subtitle, toAccountName, onEdit, onUndo, onOpenDetail }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const swipeRef = useRef<Swipeable>(null);
  const close = () => swipeRef.current?.close();

  return (
    <Reanimated.View entering={FadeInDown.duration(theme.motion.standard.duration)}>
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      renderRightActions={transaction.settledAt ? undefined : (progress) => (
        <Animated.View
          style={[
            styles.actions,
            {
              transform: [{
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [ACTIONS_WIDTH, 0],
                }),
              }],
            },
          ]}
        >
          <Pressable
            onPress={() => { close(); onEdit(transaction); }}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${transaction.type.toLowerCase()} transaction`}
            style={[styles.action, styles.editAction]}
          >
            <Feather name="edit-2" size={18} color={colors.textPrimary} />
            <AppText variant="labelSm" color="textPrimary">Edit</AppText>
          </Pressable>
          <Pressable
            onPress={() => { close(); onUndo(transaction); }}
            accessibilityRole="button"
            accessibilityLabel={`Undo ${transaction.type.toLowerCase()} transaction`}
            style={[styles.action, styles.undoAction]}
          >
            <Feather name="rotate-ccw" size={18} color={colors.textPrimary} />
            <AppText variant="labelSm" color="textPrimary">Undo</AppText>
          </Pressable>
        </Animated.View>
      )}
    >
      <ListItem
        icon={
          transaction.type === 'Transfer'
            ? 'repeat'
            : transaction.type === 'Income' ? 'arrow-down-left' : 'arrow-up-right'
        }
        iconColor={
          transaction.type === 'Transfer'
            ? colors.info
            : transaction.type === 'Income' ? colors.positive : colors.negative
        }
        title={transaction.type === 'Transfer' ? `${categoryName} → ${toAccountName ?? 'Unknown'}` : categoryName}
        subtitle={subtitle ?? displayDate(transaction.date)}
        accessibilityLabel={`${categoryName}, ${transaction.type}, ${formatPHP(transaction.amount)}, ${displayDate(transaction.date)}${transaction.receiptUri ? ', has receipt' : ''}`}
        onPress={onOpenDetail ? () => onOpenDetail(transaction) : undefined}
        trailing={
          <View style={styles.trailing}>
            {transaction.receiptUri ? (
              <Feather name="paperclip" size={14} color={colors.textMuted} />
            ) : null}
            <AppText
              variant="amountSm"
              color={
                transaction.type === 'Transfer'
                  ? 'textPrimary'
                  : transaction.type === 'Income' ? 'positive' : 'negative'
              }
            >
              {transaction.type === 'Transfer' ? '' : transaction.type === 'Expense' ? '-' : '+'}{formatPHP(transaction.amount)}
            </AppText>
          </View>
        }
      />
    </Swipeable>
    </Reanimated.View>
  );
}

const useStyles = makeStyles((c) => ({
  trailing: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  actions: { flexDirection: 'row', alignItems: 'stretch' },
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
  },
  editAction: { backgroundColor: c.bgElevated },
  undoAction: { backgroundColor: c.warning },
}));
