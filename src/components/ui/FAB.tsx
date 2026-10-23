import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, makeStyles, useTheme } from '../../theme';

type Props = {
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>['name'];
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

export function FAB({ onPress, icon = 'plus', accessibilityLabel, style }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.fab,
        { bottom: theme.spacing[4] + insets.bottom },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Feather name={icon} size={24} color={colors.onAccent} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  fab: {
    position: 'absolute',
    right: theme.spacing[5],
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    backgroundColor: c.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.md,
  },
  pressed: {
    backgroundColor: c.accentDim,
    transform: [{ scale: 0.96 }],
  },
}));
