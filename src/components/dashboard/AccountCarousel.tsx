import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../ui/AppText';
import { accountIcon } from '../../utils/accounts';
import { formatPHP } from '../../utils/currency';
import { theme, makeStyles, useTheme } from '../../theme';
import type { Account } from '../../domain/types';

const CARD_WIDTH = 140;
const CARD_GAP = theme.spacing[4];
// ponytail: cards are fixed-width, so the drop slot is just distance / stride.
const CARD_STRIDE = CARD_WIDTH + CARD_GAP;
const LONG_PRESS_MS = 200;

type Props = {
  accounts: Account[];
  onPress: (account: Account) => void;
  /** Receives the group's account ids in their new order. */
  onReorder: (ids: string[]) => void;
};

export function AccountCarousel({ accounts, onPress, onReorder }: Props) {
  const styles = useStyles();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function move(from: number, to: number) {
    if (from === to) return;
    const ids = accounts.map((a) => a.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    onReorder(ids);
  }

  return (
    <ScrollView
      horizontal
      scrollEnabled={draggingId === null}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
    >
      {accounts.map((account, index) => (
        <DraggableCard
          key={account.id}
          account={account}
          index={index}
          count={accounts.length}
          dragging={draggingId === account.id}
          onDragChange={setDraggingId}
          onMove={move}
          onPress={onPress}
        />
      ))}
    </ScrollView>
  );
}

type CardProps = {
  account: Account;
  index: number;
  count: number;
  dragging: boolean;
  onDragChange: (id: string | null) => void;
  onMove: (from: number, to: number) => void;
  onPress: (account: Account) => void;
};

function DraggableCard({
  account, index, count, dragging, onDragChange, onMove, onPress,
}: CardProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const offsetX = useSharedValue(0);
  const lift = useSharedValue(0);

  const drag = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      lift.value = withTiming(1, theme.motion.micro);
      runOnJS(onDragChange)(account.id);
    })
    .onChange((e) => {
      offsetX.value += e.changeX;
    })
    .onEnd(() => {
      const slots = Math.round(offsetX.value / CARD_STRIDE);
      const target = Math.min(count - 1, Math.max(0, index + slots));
      runOnJS(onMove)(index, target);
    })
    .onFinalize(() => {
      offsetX.value = 0;
      lift.value = withTiming(0, theme.motion.micro);
      runOnJS(onDragChange)(null);
    });

  // Exclusive: the tap only fires when the drag never activated.
  const tap = Gesture.Tap().onEnd(() => { runOnJS(onPress)(account); });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { scale: 1 + lift.value * 0.06 }],
    opacity: 1 - lift.value * 0.1,
  }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(drag, tap)}>
      <Animated.View
        accessibilityRole="button"
        accessibilityLabel={`${account.name}, ${account.typeName}, ${formatPHP(account.currentBalance)}. Long press to reorder.`}
        style={[styles.card, dragging && styles.cardDragging, animatedStyle]}
      >
        <Feather name={accountIcon(account)} size={16} color={colors.accentPrimary} />
        <AppText variant="bodySm" numberOfLines={1} style={styles.name}>
          {account.name}
        </AppText>
        <AppText
          variant="amountSm"
          color={account.currentBalance >= 0 ? 'textPrimary' : 'negative'}
        >
          {formatPHP(account.currentBalance)}
        </AppText>
      </Animated.View>
    </GestureDetector>
  );
}

const useStyles = makeStyles((c) => ({
  list: {
    paddingRight: theme.spacing[5],
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    height: 80,
    backgroundColor: c.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[4],
    justifyContent: 'space-between',
    ...theme.shadows.sm,
  },
  cardDragging: {
    zIndex: 1,
    elevation: 8,
    borderWidth: 1,
    borderColor: c.accentBorder,
  },
  name: {
    color: c.textSecondary,
  },
}));
