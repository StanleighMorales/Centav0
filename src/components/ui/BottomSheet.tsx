import React, { createContext, useContext, useEffect, useState } from 'react';
import { Modal, View, Pressable, ScrollView, ScrollViewProps, KeyboardAvoidingView, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing, SharedValue, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { theme, makeStyles } from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 800;
const ACTIVATE_DISTANCE = 8;

// Scroll content reports its offset so a downward drag only dismisses the sheet when the list is at the top.
const SheetScrollCtx = createContext<SharedValue<number> | null>(null);

export function SheetScrollView(props: ScrollViewProps) {
  const scrollY = useContext(SheetScrollCtx);
  return (
    <ScrollView
      scrollEventThrottle={16}
      {...props}
      onScroll={(e) => {
        if (scrollY) scrollY.value = e.nativeEvent.contentOffset.y;
        props.onScroll?.(e);
      }}
    />
  );
}

export function BottomSheet({ visible, onClose, title, children }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Keep the sheet clear of the status bar / camera cutout; tall content scrolls inside it.
  const maxHeight = height - insets.top - theme.spacing[4];
  // One UI-thread value drives both the sheet and the backdrop, so dragging never crosses the JS bridge.
  const translateY = useSharedValue(height);
  const scrollY = useSharedValue(0);
  const startY = useSharedValue(0);
  const closing = useSharedValue(false);
  // Stay mounted until the exit animation finishes, otherwise Modal vanishes before it plays.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      scrollY.value = 0;
      closing.value = false;
      translateY.value = withSpring(0, { damping: 28, stiffness: 260, mass: 0.9 });
    } else {
      translateY.value = withTiming(
        height,
        { duration: theme.motion.exit.duration, easing: Easing.in(Easing.cubic) },
        (finished) => { if (finished) runOnJS(setMounted)(false); },
      );
    }
  }, [visible]);

  // Every close path (drag, backdrop, handle) slides out from wherever the sheet is right now, on the UI thread,
  // and only then tells the parent. Waiting for the parent's re-render first is what made it pause mid-way.
  const dismiss = (velocity = 0) => {
    'worklet';
    if (closing.value) return;
    closing.value = true;
    // Match the finger's speed so a slow drag glides out and a flick goes quickly; never snappier than 240ms.
    const remaining = height - translateY.value;
    const duration = velocity > 0 ? Math.min(420, Math.max(240, (remaining / velocity) * 1000)) : 300;
    translateY.value = withTiming(
      height,
      { duration, easing: Easing.out(Easing.quad) },
      (finished) => { if (finished) runOnJS(onClose)(); },
    );
  };

  // Drag anywhere on the sheet down to dismiss (scroll content must be at the top); springs back if released early.
  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((e) => { startY.value = e.allTouches[0].absoluteY; })
    .onTouchesMove((e, mgr) => {
      const dy = e.allTouches[0].absoluteY - startY.value;
      if (Math.abs(dy) < ACTIVATE_DISTANCE) return;
      if (dy > 0 && scrollY.value <= 0) mgr.activate();
      else mgr.fail();
    })
    .onUpdate((e) => { translateY.value = Math.max(0, e.translationY - ACTIVATE_DISTANCE); })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) dismiss(e.velocityY);
      else translateY.value = withSpring(0, { damping: 28, stiffness: 260, mass: 0.9 });
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, height / 2], [1, 0], 'clamp'),
  }));

  return (
    <Modal transparent statusBarTranslucent visible={mounted} animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <Animated.View style={[styles.backdrop, backdropStyle]}>
            <Pressable style={styles.flex} onPress={() => dismiss()} accessibilityLabel="Close sheet" />
          </Animated.View>
          <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheet, { maxHeight, paddingBottom: insets.bottom + theme.spacing[5] }, sheetStyle]}>
            <View style={styles.dragArea}>
                <Pressable onPress={() => dismiss()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close sheet" style={styles.grabHit}>
                  <View style={styles.grab} />
                </Pressable>
                {title ? (
                  <View style={styles.header}>
                    <AppText variant="displaySm">{title}</AppText>
                  </View>
                ) : null}
            </View>
            <SheetScrollCtx.Provider value={scrollY}>{children}</SheetScrollCtx.Provider>
          </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}


const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  grabHit: { alignSelf: 'center', paddingVertical: theme.spacing[2], marginBottom: theme.spacing[2] },
  dragArea: { marginTop: -theme.spacing[3], paddingTop: theme.spacing[3] },
  backdrop: {
    flex: 1,
    backgroundColor: c.scrim,
  },
  sheet: {
    flexShrink: 1,
    backgroundColor: c.bgSurface,
    borderTopLeftRadius: theme.radius['2xl'],
    borderTopRightRadius: theme.radius['2xl'],
    borderTopWidth: 1,
    borderTopColor: c.borderDefault,
    padding: theme.spacing[5],
    paddingTop: theme.spacing[3],
    ...theme.shadows.lg,
  },
  grab: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.borderStrong,
    marginBottom: 0,
  },
  header: { marginBottom: theme.spacing[5] },
}));
