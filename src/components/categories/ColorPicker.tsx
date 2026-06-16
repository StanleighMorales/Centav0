import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../ui/AppText';
import { CATEGORY_COLORS } from '../../constants/categoryColors';
import { theme } from '../../theme';

type Props = {
  value: string | null;
  onChange: (color: string) => void;
};

export function ColorPicker({ value, onChange }: Props) {
  return (
    <View>
      <AppText variant="labelLg" color="textSecondary" style={styles.label}>Color</AppText>
      <View style={styles.row}>
        {CATEGORY_COLORS.map((color) => (
          <Pressable
            key={color}
            onPress={() => onChange(color)}
            accessibilityRole="button"
            accessibilityLabel={color}
            accessibilityState={{ selected: value === color }}
            style={[styles.swatch, { backgroundColor: color }, value === color && styles.swatchSelected]}
          >
            {value === color && (
              <Feather name="check" size={14} color={theme.colors.bgPrimary} />
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: theme.spacing[3] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[3] },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: theme.colors.textPrimary,
  },
});
