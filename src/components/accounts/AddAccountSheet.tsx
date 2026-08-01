import React, { useState, useEffect } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BottomSheet } from '../ui/BottomSheet';
import { AppTextInput } from '../ui/AppTextInput';
import { AppText } from '../ui/AppText';
import { Select } from '../ui/Select';
import { AmountInput } from '../ui/AmountInput';
import { Button } from '../ui/Button';
import { accountRepo, accountTypeRepo } from '../../repositories';
import { theme } from '../../theme';
import type { Account, AccountType as AccountTypeEntity } from '../../domain/types';

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
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [name, setName] = useState('');
  const [accountTypeId, setAccountTypeId] = useState('');
  const [accountTypes, setAccountTypes] = useState<AccountTypeEntity[]>([]);
  const [balance, setBalance] = useState(0);
  const [billDay, setBillDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [creditLimit, setCreditLimit] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setAccountTypeId(initial?.accountTypeId ?? '');
      setBalance(initial?.initialBalance ?? 0);
      setBillDay(initial?.billDay != null ? String(initial.billDay) : '');
      setDueDay(initial?.dueDay != null ? String(initial.dueDay) : '');
      setCreditLimit(initial?.creditLimit ?? 0);
      setErrors({});
      accountTypeRepo.list().then((types) => {
        setAccountTypes(types);
        if (!initial && types.length > 0) setAccountTypeId(types[0].id);
      });
    }
  }, [visible]);

  const allowsOverdraft = accountTypes.find((t) => t.id === accountTypeId)?.allowsOverdraft ?? false;

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Enter an account name';
    if (!accountTypeId) errs.accountTypeId = 'Select a type';
    if (allowsOverdraft && billDay.trim() && !parseDay(billDay)) errs.billDay = 'Enter a day between 1 and 31';
    if (allowsOverdraft && dueDay.trim() && !parseDay(dueDay)) errs.dueDay = 'Enter a day between 1 and 31';
    if (allowsOverdraft && !isEdit && creditLimit <= 0) errs.creditLimit = 'Enter the card\'s max balance';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      const cardFields = {
        billDay: allowsOverdraft ? parseDay(billDay) : undefined,
        dueDay: allowsOverdraft ? parseDay(dueDay) : undefined,
        creditLimit: allowsOverdraft && creditLimit > 0 ? creditLimit : undefined,
      };
      if (initial) {
        // Balance is computed from transactions, so edit only name + type.
        await accountRepo.update(initial.id, { name: name.trim(), accountTypeId, ...cardFields });
      } else {
        await accountRepo.create({ name: name.trim(), accountTypeId, initialBalance: balance, ...cardFields });
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
          options={accountTypes.map((t) => ({ label: t.name, value: t.id }))}
          value={accountTypeId || null}
          onChange={setAccountTypeId}
          error={errors.accountTypeId}
        />
        <Pressable
          onPress={() => { onClose(); router.push('/account-types'); }}
          accessibilityRole="button"
          accessibilityLabel="Manage account types"
          style={styles.manageTypesBtn}
        >
          <AppText variant="bodySm" color="accentPrimary">Manage types</AppText>
        </Pressable>
        {allowsOverdraft && (
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
            {isEdit ? null : (
              <AmountInput
                label="Max Balance"
                value={creditLimit}
                onChange={setCreditLimit}
                error={errors.creditLimit}
              />
            )}
          </>
        )}
        {isEdit || allowsOverdraft ? null : (
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
  manageTypesBtn: { alignSelf: 'flex-start' },
  bottomPad: { height: theme.spacing[5] },
});
