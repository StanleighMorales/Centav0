import React, { useState, useEffect } from 'react';
import { ScrollView, View, Pressable, StyleSheet, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BottomSheet } from '../ui/BottomSheet';
import { AppTextInput } from '../ui/AppTextInput';
import { AmountInput } from '../ui/AmountInput';
import { DatePicker } from '../ui/DatePicker';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { AppText } from '../ui/AppText';
import { debtRepo, accountRepo } from '../../repositories';
import { theme } from '../../theme';
import { nowIso } from '../../utils/date';
import type { Account, Debt, DebtType } from '../../domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  debtType: DebtType;
  initial?: Debt;
};

export function AddDebtSheet({ visible, onClose, onSuccess, debtType, initial }: Props) {
  const isEdit = !!initial;
  const [creditor, setCreditor] = useState('');
  const [originalAmount, setOriginalAmount] = useState(0);
  const [dueDateEnabled, setDueDateEnabled] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [note, setNote] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [installmentFee, setInstallmentFee] = useState(0);
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isLoan = (initial?.debtType ?? debtType) === 'Loan';
  const disbursementAccount = accounts.find((a) => a.id === initial?.disbursementAccountId);

  useEffect(() => {
    if (visible) {
      setCreditor(initial?.creditor ?? '');
      setOriginalAmount(0);
      const hasDue = !!initial?.dueDate;
      setDueDateEnabled(hasDue);
      setDueDate(initial?.dueDate ?? '');
      setInterestRate(initial?.interestRate != null ? String(initial.interestRate) : '');
      setNote(initial?.note ?? '');
      setIsInstallment(initial?.isInstallment ?? false);
      setMonthlyPayment(initial?.monthlyPayment ?? 0);
      setInstallmentFee(initial?.installmentFee ?? 0);
      setAccountId('');
      setErrors({});
      if (isLoan) accountRepo.list().then(setAccounts);
    }
  }, [visible]);

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!creditor.trim()) errs.creditor = 'Enter a creditor name';
    if (!isEdit && originalAmount <= 0) errs.originalAmount = 'Enter an amount greater than 0';
    if (isInstallment && monthlyPayment <= 0) errs.monthlyPayment = 'Enter the monthly payment';
    if (!isEdit && isLoan && !accountId) errs.accountId = 'Select an account to receive the loan';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      const rate = interestRate.trim() ? parseFloat(interestRate) : undefined;
      const installmentFields = {
        isInstallment,
        monthlyPayment: isInstallment ? monthlyPayment : undefined,
        installmentFee: isInstallment && installmentFee > 0 ? installmentFee : undefined,
      };
      if (isEdit && initial) {
        await debtRepo.update(initial.id, {
          creditor: creditor.trim(),
          dueDate: dueDateEnabled ? dueDate : undefined,
          interestRate: rate,
          note: note.trim() || undefined,
          ...installmentFields,
        });
      } else {
        await debtRepo.create({
          creditor: creditor.trim(),
          originalAmount,
          debtType,
          accountId: isLoan ? accountId : undefined,
          dueDate: dueDateEnabled ? dueDate : undefined,
          interestRate: rate,
          note: note.trim() || undefined,
          ...installmentFields,
        });
      }
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={isEdit ? 'Edit Debt' : 'Add Debt'}>
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppTextInput
          label="Creditor"
          value={creditor}
          onChangeText={setCreditor}
          placeholder="e.g. BDO Bank"
          error={errors.creditor}
          autoFocus={!isEdit}
        />
        {!isEdit && (
          <AmountInput
            label="Amount Borrowed"
            value={originalAmount}
            onChange={setOriginalAmount}
            error={errors.originalAmount}
          />
        )}
        {!isEdit && isLoan && (
          <Select
            label="Disburse to Account"
            options={accounts.map((a) => ({ label: a.name, value: a.id }))}
            value={accountId || null}
            onChange={setAccountId}
            placeholder="Select account…"
            error={errors.accountId}
          />
        )}
        {isEdit && isLoan && disbursementAccount && (
          <AppText variant="bodySm" color="textMuted">
            Disbursed to {disbursementAccount.name}
          </AppText>
        )}
        <View style={styles.dateWrapper}>
          {dueDateEnabled ? (
            <View>
              <DatePicker label="Due Date" value={dueDate || nowIso()} onChange={setDueDate} />
              <Pressable
                onPress={() => { setDueDateEnabled(false); setDueDate(''); }}
                accessibilityRole="button"
                accessibilityLabel="Remove due date"
                style={styles.clearDate}
              >
                <AppText variant="bodySm" color="textMuted">Remove due date</AppText>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => { setDueDateEnabled(true); setDueDate(nowIso()); }}
              accessibilityRole="button"
              accessibilityLabel="Set due date"
              style={styles.setDateBtn}
            >
              <AppText variant="labelLg" color="textSecondary">Due Date (optional)</AppText>
              <View style={styles.setDateRow}>
                <Feather name="calendar" size={14} color={theme.colors.accentPrimary} />
                <AppText variant="bodySm" color="accentPrimary">Set due date</AppText>
              </View>
            </Pressable>
          )}
        </View>
        <View style={styles.installmentRow}>
          <View style={styles.flex}>
            <AppText variant="labelLg" color="textSecondary">Installment plan</AppText>
            <AppText variant="bodySm" color="textMuted">Pay this debt monthly</AppText>
          </View>
          <Switch
            value={isInstallment}
            onValueChange={setIsInstallment}
            accessibilityLabel="Installment plan"
            trackColor={{ false: theme.colors.borderStrong, true: theme.colors.accentDim }}
            thumbColor={isInstallment ? theme.colors.accentPrimary : theme.colors.textMuted}
          />
        </View>
        {isInstallment && (
          <>
            <AmountInput
              label="Monthly Payment"
              value={monthlyPayment}
              onChange={setMonthlyPayment}
              error={errors.monthlyPayment}
            />
            <AmountInput
              label="Other Fees (optional)"
              value={installmentFee}
              onChange={setInstallmentFee}
            />
          </>
        )}
        <AppTextInput
          label="Interest Rate % (optional)"
          value={interestRate}
          onChangeText={setInterestRate}
          placeholder="e.g. 5"
          numeric
        />
        <AppTextInput
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Additional details"
        />
        <Button label={isEdit ? 'Save Changes' : 'Add Debt'} onPress={handleSave} loading={saving} />
        <View style={styles.bottomPad} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing[5] },
  dateWrapper: {},
  clearDate: { paddingTop: theme.spacing[2] },
  setDateBtn: { gap: theme.spacing[1] },
  setDateRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  installmentRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] },
  flex: { flex: 1, gap: theme.spacing[1] },
  bottomPad: { height: theme.spacing[5] },
});
