import React, { useState, useEffect } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AmountInput } from '../ui/AmountInput';
import { DatePicker } from '../ui/DatePicker';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { AppText } from '../ui/AppText';
import { lendingPaymentRepo, accountRepo } from '../../repositories';
import { theme } from '../../theme';
import { nowIso } from '../../utils/date';
import { formatPHP } from '../../utils/currency';
import type { Account } from '../../domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lendingId: string;
  personName: string;
  outstandingBalance: number;
};

type PayMode = 'full' | 'custom';

export function AddLendingPaymentSheet({ visible, onClose, onSuccess, lendingId, personName, outstandingBalance }: Props) {
  const [mode, setMode] = useState<PayMode>('full');
  const [customAmount, setCustomAmount] = useState(0);
  const [date, setDate] = useState(nowIso());
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setMode('full');
      setCustomAmount(0);
      setDate(nowIso());
      setAccountId('');
      setErrors({});
      accountRepo.list().then(setAccounts);
    }
  }, [visible]);

  const amount = mode === 'full' ? outstandingBalance : customAmount;
  const accountOptions = accounts.map((a) => ({ label: a.name, value: a.id }));

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (amount <= 0) errs.amount = 'Enter a payment amount';
    if (!accountId) errs.accountId = 'Select an account';
    if (amount > outstandingBalance) errs.amount = 'Payment is more than what is owed';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      await lendingPaymentRepo.create(lendingId, { amount, date, accountId });
      onSuccess();
      onClose();
    } catch (e) {
      setErrors({ amount: e instanceof Error ? e.message : 'Could not record payment' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Payment">
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.modeBlock}>
          <AppText variant="labelLg" color="textSecondary">Payment</AppText>
          <View style={styles.modeRow}>
            {(['full', 'custom'] as PayMode[]).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => { setMode(m); setErrors({}); }}
                  accessibilityRole="button"
                  accessibilityLabel={m === 'full' ? `Pay full, ${formatPHP(outstandingBalance)}` : 'Pay custom amount'}
                  accessibilityState={{ selected: active }}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                >
                  <AppText variant="labelLg" color={active ? 'accentPrimary' : 'textSecondary'}>
                    {m === 'full' ? 'Full' : 'Custom'}
                  </AppText>
                  <AppText variant={m === 'full' ? 'amountXs' : 'labelSm'} color={active ? 'textPrimary' : 'textMuted'}>
                    {m === 'full' ? formatPHP(outstandingBalance) : 'Enter amount'}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
        {mode === 'custom' && (
          <AmountInput
            label="Payment Amount"
            value={customAmount}
            onChange={setCustomAmount}
            error={errors.amount}
            autoFocus
          />
        )}
        <DatePicker label="Payment Date" value={date} onChange={setDate} />
        <Select
          label="To Account"
          options={accountOptions}
          value={accountId}
          onChange={setAccountId}
          placeholder="Select account…"
          error={errors.accountId}
        />
        {amount > 0 ? (
          <View style={styles.preview}>
            <AppText variant="bodySm" color="textMuted">
              {formatPHP(amount)} from {personName} to your account
            </AppText>
            {outstandingBalance - amount > 0 ? (
              <AppText variant="bodySm" color="textSecondary">
                Remaining owed: {formatPHP(outstandingBalance - amount)}
              </AppText>
            ) : (
              <AppText variant="bodySm" color="positive">Fully paid off</AppText>
            )}
          </View>
        ) : null}
        <Button
          label={amount > 0 ? `Record ${formatPHP(amount)}` : 'Record Payment'}
          onPress={handleSave}
          loading={saving}
        />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing[5] },
  modeBlock: { gap: theme.spacing[3] },
  modeRow: { flexDirection: 'row', gap: theme.spacing[3] },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing[1],
    paddingVertical: theme.spacing[4],
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.bgInput,
  },
  modeChipActive: {
    borderColor: theme.colors.accentBorder,
    backgroundColor: theme.colors.accentSubtle,
  },
  preview: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.md,
    padding: theme.spacing[4],
    gap: theme.spacing[2],
  },
});
