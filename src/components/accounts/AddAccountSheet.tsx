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
  { label: 'Credit Card', value: 'CreditCard' },
  { label: 'Other', value: 'Other' },
];

function parseDay(value: string): number | undefined {
  const day = parseInt(value, 10);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : undefined;
}

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
  const [billDay, setBillDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setType(initial?.type ?? 'Cash');
      setBalance(initial?.initialBalance ?? 0);
      setBillDay(initial?.billDay != null ? String(initial.billDay) : '');
      setDueDay(initial?.dueDay != null ? String(initial.dueDay) : '');
      setErrors({});
    }
  }, [visible]);

  const isCreditCard = type === 'CreditCard';

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Enter an account name';
    if (isCreditCard && billDay.trim() && !parseDay(billDay)) errs.billDay = 'Enter a day between 1 and 31';
    if (isCreditCard && dueDay.trim() && !parseDay(dueDay)) errs.dueDay = 'Enter a day between 1 and 31';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      const cardFields = {
        billDay: isCreditCard ? parseDay(billDay) : undefined,
        dueDay: isCreditCard ? parseDay(dueDay) : undefined,
      };
      if (initial) {
        // Balance is computed from transactions, so edit only name + type.
        await accountRepo.update(initial.id, { name: name.trim(), type, ...cardFields });
      } else {
        await accountRepo.create({ name: name.trim(), type, initialBalance: balance, ...cardFields });
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
        {isCreditCard && (
          <>
            <AppTextInput
              label="Bill Date (day of month, optional)"
              value={billDay}
              onChangeText={setBillDay}
              placeholder="e.g. 15"
              numeric
              error={errors.billDay}
            />
            <AppTextInput
              label="Due Date (day of month, optional)"
              value={dueDay}
              onChangeText={setDueDay}
              placeholder="e.g. 3"
              numeric
              error={errors.dueDay}
            />
          </>
        )}
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
