import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { theme } from '../../theme';

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  autoFocus?: boolean;
};

// ponytail: keeps raw string for editing, converts to number on blur
export function AmountInput({ label, value, onChange, error, autoFocus }: Props) {
  const [raw, setRaw] = useState(value > 0 ? String(value) : '');
  const skipNextSync = useRef(false);

  // Resync when `value` changes from outside (e.g. loading a record to edit) —
  // skip right after our own onChange so mid-typing decimals aren't clobbered.
  useEffect(() => {
    if (skipNextSync.current) { skipNextSync.current = false; return; }
    setRaw(value > 0 ? String(value) : '');
  }, [value]);

  function handleChange(text: string) {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
    setRaw(normalized);
    const num = parseFloat(normalized);
    skipNextSync.current = true;
    onChange(isNaN(num) ? 0 : num);
  }

  return (
    <View style={styles.wrapper}>
      <AppText variant="labelLg" color="textSecondary">
        {label}
      </AppText>
      <View style={[styles.inputRow, error ? styles.inputError : null]}>
        <AppText variant="amountMd" color="accentPrimary" style={styles.symbol}>
          ₱
        </AppText>
        <TextInput
          value={raw}
          onChangeText={handleChange}
          placeholder="0.00"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="decimal-pad"
          autoFocus={autoFocus}
          style={styles.input}
        />
      </View>
      {error ? (
        <AppText variant="bodySm" color="negative">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: theme.spacing[2] },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgInput,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[4],
  },
  inputError: { borderColor: theme.colors.negative },
  symbol: { marginRight: theme.spacing[2] },
  input: {
    flex: 1,
    color: theme.colors.textPrimary,
    ...theme.typography.amountMd,
  },
});
