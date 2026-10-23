import React from 'react';
import { View, Pressable } from 'react-native';
import { CategoryIcon } from '../ui/CategoryIcon';
import { AppText } from '../ui/AppText';
import { CATEGORY_ICONS } from '../../constants/categoryColors';
import { theme, makeStyles, useTheme } from '../../theme';

type Props = {
  value: string | null;
  onChange: (icon: string) => void;
};

export function IconPicker({ value, onChange }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
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
            <CategoryIcon
              name={icon}
              size={20}
              color={value === icon ? colors.accentPrimary : colors.textSecondary}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  label: { marginBottom: theme.spacing[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[3] },
  cell: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cellSelected: {
    backgroundColor: c.accentSubtle,
    borderColor: c.accentBorder,
  },
}));
