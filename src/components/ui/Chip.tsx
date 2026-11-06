import React from 'react';
import { Pressable } from 'react-native';
import { AppText } from './AppText';
import { theme, makeStyles } from '../../theme';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
};

// Filter pill. Selected inverts (ink on paper), so state is never color-only.
export function Chip({ label, selected, onPress, accessibilityLabel }: Props) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <AppText variant="labelLg" color={selected ? 'bgPrimary' : 'textSecondary'}>{label}</AppText>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  chip: {
    minHeight: 36,
    paddingHorizontal: theme.spacing[5] - 1,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: c.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: c.textPrimary, borderColor: c.textPrimary },
}));
