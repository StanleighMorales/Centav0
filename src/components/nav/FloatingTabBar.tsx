import React, { createContext, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, GestureResponderEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Reanimated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../ui/AppText';
import { theme, makeStyles, useTheme } from '../../theme';

// Space screens must leave at the bottom so content clears the floating bar.
export const TAB_BAR_SPACE = 104;

/** Counts + taps on Ledger; the open Ledger section adds its own item (credit line, debt, lending) when it changes. */
export const LedgerAddContext = createContext(0);

type TabBarState = { index: number; routes: { key: string; name: string }[] };
type Props = {
  state: TabBarState;
  navigation: any;
  /** No mode = plain form; 'voice'/'camera' come from the hold-to-open fast dial. */
  onAdd: (mode?: 'voice' | 'camera') => void;
  /** The active screen; Android can only blur what's inside a BlurTargetView. */
  blurTarget: React.RefObject<View | null>;
};

type Slot = { route: string; label: string; icon: React.ComponentProps<typeof Feather>['name'] };

const DIAL = [
  { mode: 'voice', label: 'Voice', icon: 'mic' },
  { mode: 'camera', label: 'Scan', icon: 'camera' },
] as const;
type DialMode = (typeof DIAL)[number]['mode'];

// How far up the finger must slide from + to open the dial, and to pick a dial button.
const DRAG_OPEN_DY = 12;
const DRAG_PICK_DY = 40;

// Five slots: Home · Activity · (+) · Ledger · More.
const LEFT: Slot[] = [
  { route: 'index', label: 'Home', icon: 'home' },
  { route: 'transactions', label: 'Activity', icon: 'list' },
];
const RIGHT: Slot[] = [
  { route: 'ledger', label: 'Ledger', icon: 'book-open' },
  { route: 'more', label: 'More', icon: 'grid' },
];

export function FloatingTabBar({ state, navigation, onAdd, blurTarget }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const activeName = state.routes[state.index]?.name;
  const onLedger = activeName === 'ledger';
  const [dialOpen, setDialOpen] = useState(false);
  const [hover, setHover] = useState<DialMode | null>(null);
  const touchStart = useRef({ x: 0, y: 0 });
  // A swipe can still end inside Pressable's retention area and count as a tap; this stops it opening the plain form too.
  const swiped = useRef(false);

  // Swipe up from + (or hold it), slide onto Voice or Scan, let go to pick it.
  // ponytail: picks by drag direction (up-left = Voice, up-right = Scan), not exact button bounds;
  // measure the buttons if more than two dial items are ever added.
  function onTouchMove(e: GestureResponderEvent) {
    const dx = e.nativeEvent.pageX - touchStart.current.x;
    const dy = e.nativeEvent.pageY - touchStart.current.y;
    if (dy < -DRAG_OPEN_DY) { swiped.current = true; setDialOpen(true); }
    if (swiped.current || dialOpen) setHover(dy < -DRAG_PICK_DY ? (dx < 0 ? 'voice' : 'camera') : null);
  }

  function onAddPress() {
    if (swiped.current) return;
    if (dialOpen) setDialOpen(false);
    else onAdd();
  }

  // The dial only lives while the finger is down; letting go picks the hovered button or just closes it.
  function onTouchEnd() {
    const picked = hover;
    setHover(null);
    setDialOpen(false);
    if (picked) onAdd(picked);
  }

  function go(route: string) {
    setDialOpen(false);
    const target = state.routes.find((r) => r.name === route);
    if (!target) return;
    const event = navigation.emit({ type: 'tabPress', target: target.key, canPreventDefault: true });
    if (activeName !== route && !event.defaultPrevented) navigation.navigate(route);
  }

  function renderSlot(slot: Slot) {
    const active = slot.route === activeName;
    const tint = active ? colors.accentText : colors.textMuted;
    return (
      <Pressable
        key={slot.label}
        onPress={() => go(slot.route)}
        accessibilityRole="tab"
        accessibilityLabel={`${slot.label} tab`}
        accessibilityState={{ selected: active }}
        style={styles.tab}
      >
        <Feather name={slot.icon} size={22} color={tint} />
        <AppText variant="labelSm" style={{ color: tint, letterSpacing: 0.2 }}>{slot.label}</AppText>
        {active ? <Reanimated.View entering={ZoomIn.duration(theme.motion.micro.duration)} style={styles.dot} /> : null}
      </Pressable>
    );
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: theme.spacing[3] + insets.bottom }]}>
      {dialOpen ? (
        <View pointerEvents="box-none" style={styles.dial}>
          {DIAL.map((d) => (
            <Reanimated.View key={d.mode} entering={ZoomIn.duration(theme.motion.micro.duration)} style={styles.dialItem}>
              <Pressable
                onPress={() => { setDialOpen(false); onAdd(d.mode); }}
                accessibilityRole="button"
                accessibilityLabel={d.mode === 'voice' ? (onLedger ? 'Pay or transfer by voice' : 'Add transaction by voice') : 'Scan a receipt'}
                style={({ pressed }) => [styles.dialBtn, (pressed || hover === d.mode) && styles.dialBtnHover]}
              >
                <Feather name={d.icon} size={22} color={colors.onAccent} />
              </Pressable>
              <AppText variant="labelSm" color={hover === d.mode ? 'accentText' : 'textSecondary'}>{d.label}</AppText>
            </Reanimated.View>
          ))}
        </View>
      ) : null}
      <View style={styles.bar}>
        {/* ponytail: Android 11 and below blur through RenderScript, which is slow; dimezisBlurViewSdk31Plus turns it off there if scrolling lags. */}
        <BlurView key={activeName} blurTarget={blurTarget} blurMethod="dimezisBlurView" intensity={80} tint={scheme} style={StyleSheet.absoluteFill} />
        {LEFT.map(renderSlot)}
        <Pressable
          onPress={onAddPress}
          onLongPress={() => setDialOpen(true)}
          onTouchStart={(e) => {
            touchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
            swiped.current = false;
          }}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={() => { setHover(null); setDialOpen(false); }}
          accessibilityRole="button"
          accessibilityLabel={dialOpen ? 'Close quick add' : onLedger ? 'Add to ledger' : 'Add transaction'}
          accessibilityHint="Hold for voice or receipt scan"
          style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
        >
          <Feather name={dialOpen ? 'x' : 'plus'} size={26} color={colors.onAccent} />
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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.accentBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: theme.spacing[2],
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
  dial: {
    position: 'absolute',
    bottom: 70 + theme.spacing[3],
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing[6],
  },
  dialItem: { alignItems: 'center', gap: 4 },
  dialBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.md,
  },
  dialBtnHover: {
    backgroundColor: c.accentDim,
    borderWidth: 2,
    borderColor: c.accentText,
    transform: [{ scale: 1.15 }],
  },
}));
