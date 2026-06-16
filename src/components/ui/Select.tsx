import React, { useState } from 'react';
import { View, Pressable, FlatList, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BottomSheet } from './BottomSheet';
import { AppText } from './AppText';
import { theme } from '../../theme';

export type SelectOption = { label: string; value: string };

type Props = {
  label: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
};

export function Select({ label, options, value, onChange, placeholder = 'Select…', error }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.wrapper}>
      <AppText variant="labelLg" color="textSecondary">
        {label}
      </AppText>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        style={[styles.trigger, error ? styles.triggerError : null]}
      >
        <AppText variant="body" color={selected ? 'textPrimary' : 'textMuted'}>
          {selected?.label ?? placeholder}
        </AppText>
        <Feather name="chevron-down" size={18} color={theme.colors.textSecondary} />
      </Pressable>
      {error ? (
        <AppText variant="bodySm" color="negative">
          {error}
        </AppText>
      ) : null}
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
        <FlatList
          data={options}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { onChange(item.value); setOpen(false); }}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={[styles.option, item.value === value && styles.optionSelected]}
            >
              <AppText variant="body" color={item.value === value ? 'accentPrimary' : 'textPrimary'}>
                {item.label}
              </AppText>
              {item.value === value ? (
                <Feather name="check" size={18} color={theme.colors.accentPrimary} />
              ) : null}
            </Pressable>
          )}
        />
      </BottomSheet>
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  optionSelected: { backgroundColor: theme.colors.accentSubtle },
});
