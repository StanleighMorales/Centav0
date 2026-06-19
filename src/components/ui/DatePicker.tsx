import React, { useState } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { BottomSheet } from './BottomSheet';
import { AppText } from './AppText';
import { theme } from '../../theme';
import { displayDate } from '../../utils/date';

type Props = {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  error?: string;
};

export function DatePicker({ label, value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : new Date();

  function handleChange(_: unknown, selected?: Date) {
    if (Platform.OS === 'android') setOpen(false);
    if (selected) onChange(selected.toISOString());
  }

  return (
    <View style={styles.wrapper}>
      <AppText variant="labelLg" color="textSecondary">{label}</AppText>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayDate(value)}`}
        style={[styles.trigger, error ? styles.triggerError : null]}
      >
        <AppText variant="body" color={value ? 'textPrimary' : 'textMuted'}>
          {value ? displayDate(value) : 'Select date'}
        </AppText>
        <Feather name="calendar" size={18} color={theme.colors.textSecondary} />
      </Pressable>
      {error ? <AppText variant="bodySm" color="negative">{error}</AppText> : null}

      {Platform.OS === 'ios' ? (
        <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
          <DateTimePicker
            value={date}
            mode="date"
            display="spinner"
            onChange={handleChange}
            textColor={theme.colors.textPrimary}
            style={styles.picker}
          />
        </BottomSheet>
      ) : (
        open && (
          <DateTimePicker value={date} mode="date" display="default" onChange={handleChange} />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: theme.spacing[2] },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.bgInput,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[4],
  },
  triggerError: { borderColor: theme.colors.negative },
  picker: { backgroundColor: theme.colors.bgSurface },
});
