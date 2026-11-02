import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput } from 'react-native';
import { AppText } from './AppText';
import { theme, makeStyles, useTheme } from '../../theme';

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  autoFocus?: boolean;
};

// ponytail: keeps raw string for editing, converts to number on blur
export function AmountInput({ label, value, onChange, error, autoFocus }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
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
      <AppText variant="labelSm" color="textMuted" style={styles.label}>
        {label.toUpperCase()}
      </AppText>
      <View style={[styles.inputRow, error ? styles.inputError : null]}>
        <AppText variant="amountLg" color="textMuted" style={styles.symbol}>
          ₱
        </AppText>
        <TextInput
          value={raw}
          onChangeText={handleChange}
          placeholder="0.00"
          placeholderTextColor={colors.textMuted}
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

const useStyles = makeStyles((c) => ({
  wrapper: { gap: theme.spacing[2], alignItems: 'center' },
  label: { letterSpacing: 1.2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingVertical: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: c.borderDefault,
  },
  inputError: { borderBottomColor: c.negative },
  symbol: { marginRight: theme.spacing[2] },
  input: {
    flexShrink: 1,
    minWidth: 120,
    color: c.textPrimary,
    ...theme.typography.amountXl,
    textAlign: 'center',
  },
}));
