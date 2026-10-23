import React from 'react';
import { View, ViewProps } from 'react-native';
import { theme, makeStyles } from '../../theme';

type Props = ViewProps & { elevated?: boolean; accent?: boolean };

export function Card({ elevated = false, accent = false, style, children, ...rest }: Props) {
  const styles = useStyles();
  return (
    <View style={[styles.card, elevated && styles.elevated, accent && styles.accent, style]} {...rest}>
      {children}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
    ...theme.shadows.sm,
  },
  elevated: {
    backgroundColor: c.bgElevated,
    ...theme.shadows.md,
  },
  accent: {
    backgroundColor: c.accentSubtle,
    borderWidth: 1,
    borderColor: c.accentBorder,
  },
}));
