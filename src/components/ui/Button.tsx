import React, { useState } from 'react';
import { ActivityIndicator, ViewStyle } from 'react-native';
import { AnimatedPressable, usePressScale } from './usePressScale';
import { AppText } from './AppText';
import { theme, makeStyles, useTheme } from '../../theme';

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
  const styles = useStyles();
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const [pressed, setPressed] = useState(false);
  const press = usePressScale();

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { setPressed(true); press.onPressIn(); }}
      onPressOut={() => { setPressed(false); press.onPressOut(); }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles[`${variant}Pressed` as keyof typeof styles],
        style,
        press.style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? colors.onAccent : colors.accentPrimary} />
      ) : (
        <AppText
          variant="labelLg"
          color={variant === 'primary' ? 'onAccent' : isDisabled ? 'textDisabled' : 'accentPrimary'}
        >
          {label}
        </AppText>
      )}
    </AnimatedPressable>
  );
}

const useStyles = makeStyles((c) => ({
  base: {
    height: 52,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing[6],
  },
  primary: {
    backgroundColor: c.accentPrimary,
  },
  primaryPressed: {
    backgroundColor: c.accentDim,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: c.accentPrimary,
  },
  secondaryPressed: {
    backgroundColor: c.accentSubtle,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostPressed: {
    backgroundColor: c.accentSubtle,
  },
  disabled: {
    opacity: 0.4,
  },
}));
