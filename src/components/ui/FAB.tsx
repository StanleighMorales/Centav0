import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';

type Props = {
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>['name'];
  accessibilityLabel: string;
};

export function FAB({ onPress, icon = 'plus', accessibilityLabel }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.fab,
        { bottom: theme.spacing[7] + insets.bottom },
        pressed && styles.pressed,
      ]}
    >
      <Feather name={icon} size={24} color={theme.colors.bgPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: theme.spacing[5],
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.md,
  },
  pressed: {
    backgroundColor: theme.colors.accentDim,
    transform: [{ scale: 0.96 }],
  },
});
