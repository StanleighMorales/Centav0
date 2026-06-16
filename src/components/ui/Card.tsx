import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { theme } from '../../theme';

type Props = ViewProps & { elevated?: boolean };

export function Card({ elevated = false, style, children, ...rest }: Props) {
  return (
    <View style={[styles.card, elevated && styles.elevated, style]} {...rest}>
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
});
