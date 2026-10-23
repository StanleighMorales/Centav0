import React, { useState, useEffect } from 'react';
import { ScrollView, View, Switch } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AppTextInput } from '../ui/AppTextInput';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { accountTypeRepo } from '../../repositories';
import { theme, makeStyles, useTheme } from '../../theme';
import type { AccountType } from '../../domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initial?: AccountType;
};

export function AccountTypeSheet({ visible, onClose, onSuccess, initial }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isEdit = Boolean(initial);
  const [name, setName] = useState('');
  const [allowsOverdraft, setAllowsOverdraft] = useState(false);
  const [isSavings, setIsSavings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setAllowsOverdraft(initial?.allowsOverdraft ?? false);
      setIsSavings(initial?.isSavings ?? false);
      setErrors({});
    }
  }, [visible]);

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Enter a type name';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      if (isEdit && initial) {
        await accountTypeRepo.update(initial.id, { name: name.trim(), allowsOverdraft, isSavings });
      } else {
        await accountTypeRepo.create({ name: name.trim(), allowsOverdraft, isSavings });
      }
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={isEdit ? 'Edit Account Type' : 'Add Account Type'}>
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppTextInput
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Line of Credit"
          error={errors.name}
          autoFocus
        />
        <View style={styles.overdraftRow}>
          <View style={styles.flex}>
            <AppText variant="labelLg" color="textSecondary">Allows overdraft</AppText>
            <AppText variant="bodySm" color="textMuted">
              Accounts of this type can go negative and are excluded from accumulated balance
            </AppText>
          </View>
          <Switch
            value={allowsOverdraft}
            onValueChange={(v) => { setAllowsOverdraft(v); if (v) setIsSavings(false); }}
            accessibilityLabel="Allows overdraft"
            trackColor={{ false: colors.borderStrong, true: colors.accentDim }}
            thumbColor={allowsOverdraft ? colors.accentPrimary : colors.textMuted}
          />
        </View>
        <View style={styles.overdraftRow}>
          <View style={styles.flex}>
            <AppText variant="labelLg" color="textSecondary">Savings</AppText>
            <AppText variant="bodySm" color="textMuted">
              Money set aside — tallied under Total Savings instead of Total Balance
            </AppText>
          </View>
          <Switch
            value={isSavings}
            onValueChange={(v) => { setIsSavings(v); if (v) setAllowsOverdraft(false); }}
            accessibilityLabel="Savings"
            trackColor={{ false: colors.borderStrong, true: colors.accentDim }}
            thumbColor={isSavings ? colors.accentPrimary : colors.textMuted}
          />
        </View>
        <Button label={isEdit ? 'Save Changes' : 'Add Type'} onPress={handleSave} loading={saving} />
        <View style={styles.bottomPad} />
      </ScrollView>
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
  form: { gap: theme.spacing[5] },
  overdraftRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] },
  flex: { flex: 1, gap: theme.spacing[1] },
  bottomPad: { height: theme.spacing[5] },
}));
