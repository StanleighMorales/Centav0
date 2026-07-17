import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../ui/AppText';
import { AppTextInput } from '../ui/AppTextInput';
import { Button } from '../ui/Button';
import { HsvPicker } from './HsvPicker';
import { CATEGORY_COLORS } from '../../constants/categoryColors';
import { theme } from '../../theme';

type Props = {
  value: string | null;
  onChange: (color: string) => void;
};

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function normalizeHex(input: string): string {
  const trimmed = input.trim().replace(/^#*/, '#');
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

export function ColorPicker({ value, onChange }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value ?? '');
  const isCustom = value !== null && !(CATEGORY_COLORS as readonly string[]).includes(value);
  const hexError = hexInput && !HEX_RE.test(normalizeHex(hexInput)) ? 'Enter a 6-digit hex code, e.g. #FF8800' : undefined;

  function applyCustom() {
    const hex = normalizeHex(hexInput);
    if (!HEX_RE.test(hex)) return;
    onChange(hex);
    setCustomOpen(false);
  }

  return (
    <View>
      <AppText variant="labelLg" color="textSecondary" style={styles.label}>Color</AppText>
      <View style={styles.row}>
        {isCustom && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Custom color ${value}`}
            accessibilityState={{ selected: true }}
            style={[styles.swatch, { backgroundColor: value as string }, styles.swatchSelected]}
          >
            <Feather name="check" size={14} color={theme.colors.bgPrimary} />
          </Pressable>
        )}
        {CATEGORY_COLORS.map((color) => (
          <Pressable
            key={color}
            onPress={() => { onChange(color); setCustomOpen(false); }}
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
        <Pressable
          onPress={() => { setHexInput(value ?? ''); setCustomOpen((v) => !v); }}
          accessibilityRole="button"
          accessibilityLabel="Pick a custom color"
          accessibilityState={{ selected: customOpen }}
          style={[styles.swatch, styles.customBtn, customOpen && styles.swatchSelected]}
        >
          <Feather name="plus" size={16} color={theme.colors.textSecondary} />
        </Pressable>
      </View>
      {customOpen && (
        <View style={styles.customPanel}>
          <HsvPicker
            value={HEX_RE.test(normalizeHex(hexInput)) ? normalizeHex(hexInput) : (value ?? CATEGORY_COLORS[0])}
            onChange={setHexInput}
          />
          <View style={styles.customRow}>
            <View style={[styles.customPreview, { backgroundColor: HEX_RE.test(normalizeHex(hexInput)) ? normalizeHex(hexInput) : theme.colors.bgElevated }]} />
            <View style={styles.customInput}>
              <AppTextInput
                label="Hex"
                value={hexInput}
                onChangeText={setHexInput}
                placeholder="#FF8800"
                error={hexError}
              />
            </View>
            <Button label="Use" onPress={applyCustom} />
          </View>
        </View>
      )}
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
  customBtn: {
    backgroundColor: theme.colors.bgElevated,
    borderColor: theme.colors.borderDefault,
    borderStyle: 'dashed',
  },
  customPanel: {
    marginTop: theme.spacing[4],
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing[3],
    marginTop: theme.spacing[4],
  },
  customPreview: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    marginBottom: theme.spacing[1],
  },
  customInput: { flex: 1 },
});
