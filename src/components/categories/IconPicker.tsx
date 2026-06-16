import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../ui/AppText';
import { CATEGORY_ICONS } from '../../constants/categoryColors';
import { theme } from '../../theme';

type Props = {
  value: string | null;
  onChange: (icon: string) => void;
};

export function IconPicker({ value, onChange }: Props) {
  return (
    <View>
      <AppText variant="labelLg" color="textSecondary" style={styles.label}>Icon</AppText>
      <View style={styles.grid}>
        {CATEGORY_ICONS.map((icon) => (
          <Pressable
            key={icon}
            onPress={() => onChange(icon)}
            accessibilityRole="button"
            accessibilityLabel={icon}
            accessibilityState={{ selected: value === icon }}
            style={[styles.cell, value === icon && styles.cellSelected]}
          >
            <Feather
              name={icon as React.ComponentProps<typeof Feather>['name']}
              size={20}
              color={value === icon ? theme.colors.accentPrimary : theme.colors.textSecondary}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: theme.spacing[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[3] },
  cell: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cellSelected: {
    backgroundColor: theme.colors.accentSubtle,
    borderColor: theme.colors.accentBorder,
  },
});
