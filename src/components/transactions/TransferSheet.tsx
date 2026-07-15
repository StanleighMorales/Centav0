import React, { useState, useEffect } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AmountInput } from '../ui/AmountInput';
import { AppTextInput } from '../ui/AppTextInput';
import { Select } from '../ui/Select';
import { DatePicker } from '../ui/DatePicker';
import { Button } from '../ui/Button';
import { AppText } from '../ui/AppText';
import { accountRepo, transactionRepo } from '../../repositories';
import { nowIso } from '../../utils/date';
import { formatPHP } from '../../utils/currency';
import { theme } from '../../theme';
import type { Account } from '../../domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function TransferSheet({ visible, onClose, onSuccess }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(nowIso());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) {
      setAmount(0);
      setAccountId(null);
      setToAccountId(null);
      setDate(nowIso());
      setNote('');
      setErrors({});
      return;
    }
    accountRepo.list().then((accs) => {
      setAccounts(accs);
      if (accs.length > 0) setAccountId(accs[0].id);
      if (accs.length > 1) setToAccountId(accs[1].id);
    });
  }, [visible]);

  const source = accounts.find((a) => a.id === accountId);
  const destOptions = accounts.filter((a) => a.id !== accountId);

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (amount <= 0) errs.amount = 'Enter an amount';
    if (!accountId) errs.accountId = 'Select a source account';
    if (!toAccountId) errs.toAccountId = 'Select a destination account';
    if (accountId && toAccountId && accountId === toAccountId) errs.toAccountId = 'Pick a different account';
    if (source && source.type !== 'CreditCard' && amount > source.currentBalance) {
      errs.amount = 'Transfer is more than this account has';
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      await transactionRepo.createTransfer({
        date, amount, accountId: accountId!, toAccountId: toAccountId!,
        note: note.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (e) {
      setErrors({ amount: e instanceof Error ? e.message : 'Could not record transfer' });
    } finally {
      setSaving(false);
    }
  }

  const remainingSource = source ? source.currentBalance - amount : 0;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Transfer Between Accounts">
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AmountInput label="Amount" value={amount} onChange={setAmount} error={errors.amount} />
        <Select
          label="From Account"
          options={accounts.map((a) => ({ label: `${a.name} (${formatPHP(a.currentBalance)})`, value: a.id }))}
          value={accountId}
          onChange={(v) => {
            setAccountId(v);
            if (v === toAccountId) setToAccountId(null);
          }}
          error={errors.accountId}
        />
        <Select
          label="To Account"
          options={destOptions.map((a) => ({ label: `${a.name} (${formatPHP(a.currentBalance)})`, value: a.id }))}
          value={toAccountId}
          onChange={setToAccountId}
          error={errors.toAccountId}
          placeholder={destOptions.length === 0 ? 'Add another account first' : 'Select…'}
        />
        <DatePicker label="Date" value={date} onChange={setDate} />
        <AppTextInput
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Add a note..."
        />
        {source && amount > 0 ? (
          <View style={styles.preview}>
            <AppText
              variant="bodySm"
              color={remainingSource < 0 && source.type !== 'CreditCard' ? 'negative' : 'textSecondary'}
            >
              {source.name} after transfer: {formatPHP(remainingSource)}
              {source.type === 'CreditCard' && remainingSource < 0 ? ' (credit used)' : ''}
            </AppText>
          </View>
        ) : null}
        <Button label="Transfer" onPress={handleSave} loading={saving} />
        <View style={styles.bottomPad} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing[5] },
  preview: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.md,
    padding: theme.spacing[4],
    gap: theme.spacing[2],
  },
  bottomPad: { height: theme.spacing[5] },
});
