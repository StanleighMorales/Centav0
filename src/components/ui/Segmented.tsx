import React from 'react';
import { View, Pressable } from 'react-native';
import { AppText } from './AppText';
import { theme, makeStyles } from '../../theme';

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
};

// Pill-in-a-track switch (Debts | Lent, System | Light | Dark). The selected option inverts, so it never relies on color alone.
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const styles = useStyles();
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            accessibilityRole="tab"
            accessibilityLabel={opt}
            accessibilityState={{ selected: active }}
            style={[styles.item, active && styles.itemActive]}
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
    padding: 4,
  },
  item: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.lg,
  },
  itemActive: { backgroundColor: c.textPrimary },
}));
