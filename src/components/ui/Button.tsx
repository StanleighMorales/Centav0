import React from 'react';
import { Pressable, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { theme } from '../../theme';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, accessibilityLabel, style }: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles[`${variant}Pressed` as keyof typeof styles],
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? theme.colors.bgPrimary : theme.colors.accentPrimary} />
      ) : (
        <AppText
          variant="labelLg"
          color={variant === 'primary' ? 'bgPrimary' : isDisabled ? 'textDisabled' : 'accentPrimary'}
        >
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing[6],
  },
  primary: {
    backgroundColor: theme.colors.accentPrimary,
  },
  primaryPressed: {
    backgroundColor: theme.colors.accentDim,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.accentPrimary,
  },
  secondaryPressed: {
    backgroundColor: theme.colors.accentSubtle,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostPressed: {
    backgroundColor: theme.colors.accentSubtle,
  },
  disabled: {
    opacity: 0.4,
  },
});
