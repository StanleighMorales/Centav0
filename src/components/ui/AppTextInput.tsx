import React from 'react';
import { View, TextInput, KeyboardTypeOptions } from 'react-native';
import { AppText } from './AppText';
import { theme, makeStyles, useTheme } from '../../theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  numeric?: boolean;
  secureTextEntry?: boolean;
  autoFocus?: boolean;
  editable?: boolean;
  onBlur?: () => void;
};

export function AppTextInput({ label, value, onChangeText, placeholder, error, numeric, secureTextEntry, autoFocus, editable = true, onBlur }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const keyboardType: KeyboardTypeOptions = numeric ? 'decimal-pad' : 'default';

  return (
    <View style={styles.wrapper}>
      <AppText variant="labelLg" color="textSecondary" style={styles.label}>
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoFocus={autoFocus}
        editable={editable}
        onBlur={onBlur}
        style={[styles.input, error ? styles.inputError : null, !editable && styles.inputDisabled]}
      />
      {error ? (
        <AppText variant="bodySm" color="negative" style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrapper: { gap: theme.spacing[2] },
  label: { marginBottom: theme.spacing[1] },
  input: {
    backgroundColor: c.bgInput,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: c.borderDefault,
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[4],
    color: c.textPrimary,
    ...theme.typography.body,
  },
  inputError: { borderColor: c.negative },
  inputDisabled: { opacity: 0.5 },
  error: { marginTop: theme.spacing[1] },
}));
