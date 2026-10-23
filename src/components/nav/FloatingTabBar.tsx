import React from 'react';
import { View, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../ui/AppText';
import { theme, makeStyles, useTheme } from '../../theme';

// Space screens must leave at the bottom so content clears the floating bar.
export const TAB_BAR_SPACE = 104;

type TabBarState = { index: number; routes: { key: string; name: string }[] };
type Props = {
  state: TabBarState;
  navigation: any;
  onAdd: () => void;
  onMore: () => void;
};

type Slot = { route: string | null; label: string; icon: React.ComponentProps<typeof Feather>['name'] };

// Five slots: Home · Activity · (+) · Ledger · More. `route: null` = opens a sheet instead of a screen.
const LEFT: Slot[] = [
  { route: 'index', label: 'Home', icon: 'home' },
  { route: 'transactions', label: 'Activity', icon: 'list' },
];
const RIGHT: Slot[] = [
  { route: 'ledger', label: 'Ledger', icon: 'book-open' },
  { route: null, label: 'More', icon: 'grid' },
];

export function FloatingTabBar({ state, navigation, onAdd, onMore }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const activeName = state.routes[state.index]?.name;

  function go(route: string) {
    const target = state.routes.find((r) => r.name === route);
    if (!target) return;
    const event = navigation.emit({ type: 'tabPress', target: target.key, canPreventDefault: true });
    if (activeName !== route && !event.defaultPrevented) navigation.navigate(route);
  }

  function renderSlot(slot: Slot) {
    const active = slot.route !== null && slot.route === activeName;
    const tint = active ? colors.accentText : colors.textMuted;
    return (
      <Pressable
        key={slot.label}
        onPress={() => (slot.route ? go(slot.route) : onMore())}
        accessibilityRole="tab"
        accessibilityLabel={`${slot.label} tab`}
        accessibilityState={{ selected: active }}
        style={styles.tab}
      >
        <Feather name={slot.icon} size={22} color={tint} />
        <AppText variant="labelSm" style={{ color: tint, letterSpacing: 0.2 }}>{slot.label}</AppText>
        {active ? <View style={styles.dot} /> : null}
      </Pressable>
    );
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: theme.spacing[3] + insets.bottom }]}>
      <View style={styles.bar}>
        {LEFT.map(renderSlot)}
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Add transaction"
          style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
        >
          <Feather name="plus" size={26} color={colors.onAccent} />
        </Pressable>
        {RIGHT.map(renderSlot)}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { position: 'absolute', left: theme.spacing[5] - 4, right: theme.spacing[5] - 4 },
  bar: {
    height: 70,
    borderRadius: 35,
    backgroundColor: c.bgSurface,
    borderWidth: 1,
    borderColor: c.borderDefault,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: theme.spacing[2],
    ...theme.shadows.lg,
  },
  tab: { width: 62, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dot: { position: 'absolute', bottom: -2, width: 4, height: 4, borderRadius: 2, backgroundColor: c.accentPrimary },
  add: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: c.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPressed: { backgroundColor: c.accentDim, transform: [{ scale: 0.95 }] },
}));
