import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { AppText } from './AppText';
import { theme, makeStyles } from '../../theme';

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
};

const PAD = 4;

// Pill-in-a-track switch (Debts | Lent, System | Light | Dark). The selected option inverts, so it never relies on color alone.
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const itemW = (width - PAD * 2) / options.length;
  const index = options.indexOf(value);
  const pill = useAnimatedStyle(() => ({
    width: itemW,
    transform: [{ translateX: withTiming(index * itemW, theme.motion.standard) }],
  }));

  return (
    <View style={styles.track} accessibilityRole="tablist" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? <Animated.View style={[styles.pill, pill]} /> : null}
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            accessibilityRole="tab"
            accessibilityLabel={opt}
            accessibilityState={{ selected: active }}
            style={styles.item}
          >
            <AppText variant="labelLg" color={active ? 'bgPrimary' : 'textSecondary'}>{opt}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  track: {
    flexDirection: 'row',
    backgroundColor: c.bgSurface,
    borderWidth: 1,
    borderColor: c.borderDefault,
    borderRadius: theme.radius.xl,
    padding: PAD,
  },
  pill: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: theme.radius.lg,
    backgroundColor: c.textPrimary,
  },
  item: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.lg,
  },
}));
