import React, { useState, useEffect } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AmountInput } from '../ui/AmountInput';
import { DatePicker } from '../ui/DatePicker';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { AppText } from '../ui/AppText';
import { debtPaymentRepo, accountRepo } from '../../repositories';
import { theme } from '../../theme';
import { nowIso } from '../../utils/date';
import { formatPHP } from '../../utils/currency';
import type { Account } from '../../domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  debtId: string;
  creditor: string;
  outstandingBalance: number;
};

export function AddPaymentSheet({ visible, onClose, onSuccess, debtId, creditor, outstandingBalance }: Props) {
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(nowIso());
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setAmount(0);
      setDate(nowIso());
      setAccountId('');
      setErrors({});
      accountRepo.list().then(setAccounts);
    }
  }, [visible]);

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (amount <= 0) errs.amount = 'Enter a payment amount';
    if (!accountId) errs.accountId = 'Select an account';
    const selected = accounts.find((a) => a.id === accountId);
    if (amount > outstandingBalance) errs.amount = 'Payment is more than the remaining debt';
    if (selected && amount > selected.currentBalance) errs.amount = 'Payment is more than this account has';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      await debtPaymentRepo.create(debtId, { amount, date, accountId });
      onSuccess();
      onClose();
    } catch (e) {
      setErrors({ amount: e instanceof Error ? e.message : 'Could not record payment' });
    } finally {
      setSaving(false);
    }
  }

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const remainingDebt = Math.max(0, outstandingBalance - amount);
  const remainingSource = selectedAccount ? selectedAccount.currentBalance - amount : 0;
  const accountOptions = accounts.map((a) => ({
    label: `${a.name} (${formatPHP(a.currentBalance)})`,
    value: a.id,
  }));

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Payment">
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AmountInput
          label="Payment Amount"
          value={amount}
          onChange={setAmount}
          error={errors.amount}
          autoFocus
        />
        <DatePicker label="Payment Date" value={date} onChange={setDate} />
        <Select
          label="From Account"
          options={accountOptions}
          value={accountId}
          onChange={setAccountId}
          placeholder="Select account…"
          error={errors.accountId}
        />
        {selectedAccount ? (
          <View style={styles.preview}>
            <AppText variant="bodySm" color="textMuted">
              {formatPHP(amount)} from {selectedAccount.name} to {creditor}
            </AppText>
            <AppText variant="bodySm" color={remainingSource < 0 ? 'negative' : 'textSecondary'}>
              {selectedAccount.name} after payment: {formatPHP(remainingSource)}
            </AppText>
            <AppText variant="bodySm" color={remainingDebt > 0 ? 'textSecondary' : 'positive'}>
              Debt left after payment: {formatPHP(remainingDebt)}
            </AppText>
          </View>
        ) : null}
        <Button label="Record Payment" onPress={handleSave} loading={saving} />
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
