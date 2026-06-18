import React, { useState, useEffect } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AppTextInput } from '../ui/AppTextInput';
import { Select } from '../ui/Select';
import { AmountInput } from '../ui/AmountInput';
import { Button } from '../ui/Button';
import { accountRepo } from '../../repositories';
import { theme } from '../../theme';
import type { Account, AccountType } from '../../domain/types';

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
  initial?: Account;
};

export function AddAccountSheet({ visible, onClose, onSuccess, initial }: Props) {
  const isEdit = Boolean(initial);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('Cash');
  const [balance, setBalance] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setType(initial?.type ?? 'Cash');
      setBalance(initial?.initialBalance ?? 0);
      setErrors({});
    }
  }, [visible]);

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Enter an account name';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      if (initial) {
        // Balance is computed from transactions, so edit only name + type.
        await accountRepo.update(initial.id, { name: name.trim(), type });
      } else {
        await accountRepo.create({ name: name.trim(), type, initialBalance: balance });
      }
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={isEdit ? 'Edit Account' : 'Add Account'}>
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
        {isEdit ? null : (
          <AmountInput label="Initial Balance" value={balance} onChange={setBalance} />
        )}
        <Button label={isEdit ? 'Save Changes' : 'Add Account'} onPress={handleSave} loading={saving} />
        <View style={styles.bottomPad} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing[5] },
  bottomPad: { height: theme.spacing[5] },
});
