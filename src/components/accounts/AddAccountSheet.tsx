import React, { useState, useEffect } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AppTextInput } from '../ui/AppTextInput';
import { Select } from '../ui/Select';
import { AmountInput } from '../ui/AmountInput';
import { Button } from '../ui/Button';
import { accountRepo } from '../../repositories';
import { theme } from '../../theme';
import type { AccountType } from '../../domain/types';

const TYPE_OPTIONS = [
  { label: 'Cash', value: 'Cash' },
  { label: 'Bank', value: 'Bank' },
  { label: 'E-Wallet', value: 'EWallet' },
  { label: 'Other', value: 'Other' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddAccountSheet({ visible, onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('Cash');
  const [balance, setBalance] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) {
      setName('');
      setType('Cash');
      setBalance(0);
      setErrors({});
    }
  }, [visible]);

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Enter an account name';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      await accountRepo.create({ name: name.trim(), type, initialBalance: balance });
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Account">
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppTextInput
          label="Account Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. BDO Savings"
          error={errors.name}
        />
        <Select
          label="Type"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(v) => setType(v as AccountType)}
        />
        <AmountInput label="Initial Balance" value={balance} onChange={setBalance} />
        <Button label="Add Account" onPress={handleSave} loading={saving} />
        <View style={styles.bottomPad} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing[5] },
  bottomPad: { height: theme.spacing[5] },
});
