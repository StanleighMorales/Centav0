import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AppTextInput } from '../ui/AppTextInput';
import { AmountInput } from '../ui/AmountInput';
import { DatePicker } from '../ui/DatePicker';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { lendingRepo, lendingPersonRepo, accountRepo } from '../../repositories';
import { theme } from '../../theme';
import { nowIso } from '../../utils/date';
import type { Lending, LendingPerson, Account } from '../../domain/types';

const NEW_PERSON = '__new__';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initial?: Lending;
};

export function AddLendingSheet({ visible, onClose, onSuccess, initial }: Props) {
  const isEdit = !!initial;
  const [people, setPeople] = useState<LendingPerson[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [personId, setPersonId] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(nowIso());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      lendingPersonRepo.list().then(setPeople);
      accountRepo.list().then(setAccounts);
      setPersonId(initial?.personId ?? '');
      setNewPersonName('');
      setAmount(0);
      setAccountId(initial?.accountId ?? '');
      setDate(initial?.date ?? nowIso());
      setNote(initial?.note ?? '');
      setErrors({});
    }
  }, [visible]);

  const personOptions = [
    ...people.map((p) => ({ label: p.name, value: p.id })),
    { label: '+ Add new person', value: NEW_PERSON },
  ];
  const accountOptions = accounts.map((a) => ({ label: a.name, value: a.id }));

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!isEdit) {
      if (!personId) errs.personId = 'Select a person';
      if (personId === NEW_PERSON && !newPersonName.trim()) errs.personId = 'Enter a name';
      if (amount <= 0) errs.amount = 'Enter an amount greater than 0';
      if (!accountId) errs.accountId = 'Select an account';
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      if (isEdit && initial) {
        await lendingRepo.update(initial.id, { note: note.trim() || undefined });
      } else {
        let resolvedPersonId = personId;
        if (personId === NEW_PERSON) {
          const created = await lendingPersonRepo.create({ name: newPersonName.trim() });
          resolvedPersonId = created.id;
        }
        await lendingRepo.create({
          personId: resolvedPersonId,
          amount,
          accountId,
          date,
          note: note.trim() || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (e) {
      setErrors({ amount: e instanceof Error ? e.message : 'Could not save lending' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={isEdit ? 'Edit Lending' : 'Lend Money'}>
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!isEdit && (
          <>
            <Select
              label="Person"
              options={personOptions}
              value={personId}
              onChange={setPersonId}
              placeholder="Select person…"
              error={errors.personId}
            />
            {personId === NEW_PERSON && (
              <AppTextInput
                label="New Person's Name"
                value={newPersonName}
                onChangeText={setNewPersonName}
                placeholder="e.g. Mom"
                autoFocus
              />
            )}
            <AmountInput
              label="Amount Lent"
              value={amount}
              onChange={setAmount}
              error={errors.amount}
            />
            <Select
              label="From Account"
              options={accountOptions}
              value={accountId}
              onChange={setAccountId}
              placeholder="Select account…"
              error={errors.accountId}
            />
            <DatePicker label="Date" value={date} onChange={setDate} />
          </>
        )}
        <AppTextInput
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Additional details"
        />
        <Button label={isEdit ? 'Save Changes' : 'Lend Money'} onPress={handleSave} loading={saving} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing[5] },
});
