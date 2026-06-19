import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { theme } from '../../theme';

type Props = ViewProps & { elevated?: boolean; accent?: boolean };

export function Card({ elevated = false, accent = false, style, children, ...rest }: Props) {
  return (
    <View style={[styles.card, elevated && styles.elevated, accent && styles.accent, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
    ...theme.shadows.sm,
  },
  elevated: {
    backgroundColor: theme.colors.bgElevated,
    ...theme.shadows.md,
  },
  accent: {
    backgroundColor: theme.colors.accentSubtle,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
});
