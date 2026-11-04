import React, { useState, useEffect } from 'react';
import { View, Pressable, Switch } from 'react-native';
import { SheetScrollView as ScrollView } from '../ui/BottomSheet';
import { Feather } from '@expo/vector-icons';
import { BottomSheet } from '../ui/BottomSheet';
import { AppTextInput } from '../ui/AppTextInput';
import { AmountInput } from '../ui/AmountInput';
import { DatePicker } from '../ui/DatePicker';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { AppText } from '../ui/AppText';
import { debtRepo, accountRepo } from '../../repositories';
import { theme, makeStyles, useTheme } from '../../theme';
import { nowIso } from '../../utils/date';
import { formatPHP } from '../../utils/currency';
import { flatLoanTerms, pastPayments } from '../../utils/loanTerms';
import { addMonthsClamped } from '../../utils/installmentSchedule';
import type { Account, Debt, DebtType } from '../../domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  debtType: DebtType;
  initial?: Debt;
};

export function AddDebtSheet({ visible, onClose, onSuccess, debtType, initial }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
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
  const [termMonths, setTermMonths] = useState('');
  const [monthlyInterest, setMonthlyInterest] = useState(0);
  // New loans take the lender's monthly rates; the paid months are logged as history.
  const [interestPct, setInterestPct] = useState('');
  const [feePct, setFeePct] = useState('');
  const [paidMonthsText, setPaidMonthsText] = useState('0');
  const [accountId, setAccountId] = useState('');
  const [alreadyReceived, setAlreadyReceived] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isLoan = (initial?.debtType ?? debtType) === 'Loan';
  const flatMode = !isEdit && isLoan && isInstallment;
  const termsMonths = parseInt(termMonths, 10);
  const paidMonths = parseInt(paidMonthsText, 10) || 0;
  const terms = flatMode && originalAmount > 0 && termsMonths > 0
    ? flatLoanTerms({
      amount: originalAmount, months: termsMonths, interestPct: parseFloat(interestPct) || 0, feePct: parseFloat(feePct) || 0,
      oneTimeFee: installmentFee, paidMonths: Math.min(Math.max(paidMonths, 0), termsMonths), paymentOverride: monthlyPayment,
    })
    : null;
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
      setTermMonths(initial?.termMonths != null ? String(initial.termMonths) : '');
      setMonthlyInterest(initial?.monthlyInterest ?? 0);
      setInterestPct('');
      setFeePct('');
      setPaidMonthsText('0');
      setAccountId('');
      setErrors({});
      setAlreadyReceived(false);
      if (isLoan) accountRepo.list().then(setAccounts);
    }
  }, [visible]);

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!creditor.trim()) errs.creditor = 'Enter a creditor name';
    if (!isEdit && originalAmount <= 0) errs.originalAmount = 'Enter an amount greater than 0';
    if (isInstallment && !flatMode && monthlyPayment <= 0) errs.monthlyPayment = 'Enter the monthly payment';
    let parsedTermMonths: number | undefined;
    if (isInstallment) {
      parsedTermMonths = parseInt(termMonths, 10);
      if (!termMonths.trim() || Number.isNaN(parsedTermMonths) || parsedTermMonths <= 0) {
        errs.termMonths = 'Enter the number of months';
      }
    }
    if (flatMode) {
      if (paidMonths < 0 || paidMonths > (parsedTermMonths ?? 0)) errs.paidMonths = `Enter 0 to ${parsedTermMonths || 0} months`;
      else if (terms && terms.principalPart <= 0) errs.monthlyPayment = 'Payment must be more than the interest and fees';
    }
    if (!isEdit && isLoan && !alreadyReceived && !accountId) errs.accountId = 'Select an account to receive the loan';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      const rate = interestRate.trim() ? parseFloat(interestRate) : undefined;
      const extra = terms ? terms.extra : monthlyInterest;
      const installmentFields = {
        isInstallment,
        monthlyPayment: isInstallment ? (terms ? terms.principalPart : monthlyPayment) : undefined,
        installmentFee: isInstallment && installmentFee > 0 ? installmentFee : undefined,
        termMonths: isInstallment ? parsedTermMonths : undefined,
        monthlyInterest: isInstallment && extra > 0 ? extra : undefined,
        ...(terms ? {
          totalRepayable: terms.total,
          pastPayments: pastPayments(
            Array.from({ length: paidMonths }, (_, k) => addMonthsClamped(dueDate, k)),
            terms.monthlyPayment,
            installmentFee,
          ),
        } : {}),
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
          accountId: isLoan && !alreadyReceived ? accountId : undefined,
          alreadyReceived: isLoan && alreadyReceived,
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
          <View style={styles.installmentRow}>
            <View style={styles.flex}>
              <AppText variant="labelLg" color="textSecondary">Already received</AppText>
              <AppText variant="bodySm" color="textMuted">
                {alreadyReceived ? 'The money is already in one of your accounts' : 'Add the borrowed money to an account'}
              </AppText>
            </View>
            <Switch
              value={alreadyReceived}
              onValueChange={setAlreadyReceived}
              accessibilityLabel="Loan money already received"
              trackColor={{ false: colors.borderStrong, true: colors.accentDim }}
              thumbColor={alreadyReceived ? colors.accentPrimary : colors.textMuted}
            />
          </View>
        )}
        {!isEdit && isLoan && !alreadyReceived && (
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
              <DatePicker label={flatMode ? 'First Due Date' : 'Due Date'} value={dueDate || nowIso()} onChange={setDueDate} />
              {!isInstallment && (
                <Pressable
                  onPress={() => { setDueDateEnabled(false); setDueDate(''); }}
                  accessibilityRole="button"
                  accessibilityLabel="Remove due date"
                  style={styles.clearDate}
                >
                  <AppText variant="bodySm" color="textMuted">Remove due date</AppText>
                </Pressable>
              )}
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
                <Feather name="calendar" size={14} color={colors.accentPrimary} />
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
            onValueChange={(on) => {
              setIsInstallment(on);
              // An installment plan schedules from the due date; without one
              // buildSchedule() returns [] and the loan silently vanishes from
              // the Monthly and Grid views.
              if (on && !dueDateEnabled) { setDueDateEnabled(true); setDueDate(nowIso()); }
            }}
            accessibilityLabel="Installment plan"
            trackColor={{ false: colors.borderStrong, true: colors.accentDim }}
            thumbColor={isInstallment ? colors.accentPrimary : colors.textMuted}
          />
        </View>
        {isInstallment && (
          <>
            {flatMode ? (
              <>
                <AppTextInput label="Term (months)" value={termMonths} onChangeText={setTermMonths} placeholder="e.g. 12" error={errors.termMonths} numeric />
                <AppTextInput label="Interest per month %" value={interestPct} onChangeText={setInterestPct} placeholder="e.g. 3.95" numeric />
                <AppTextInput label="Fee per month % (e.g. loan protection)" value={feePct} onChangeText={setFeePct} placeholder="e.g. 0.20" numeric />
                <AmountInput label="One-time fee (optional)" value={installmentFee} onChange={setInstallmentFee} />
                <AppTextInput label="Months already paid" value={paidMonthsText} onChangeText={setPaidMonthsText} error={errors.paidMonths} numeric />
                <AmountInput
                  label="Monthly payment (optional, the lender's exact figure)"
                  value={monthlyPayment}
                  onChange={setMonthlyPayment}
                  error={errors.monthlyPayment}
                />
                {terms ? (
                  <View style={styles.preview}>
                    <AppText variant="bodySm" color="textSecondary">
                      {formatPHP(terms.monthlyPayment)}/month · {formatPHP(terms.total)} to repay
                      {' '}({formatPHP(terms.interestAndFees)} interest and fees)
                    </AppText>
                    <AppText variant="labelLg" color="textPrimary">{formatPHP(terms.remaining)} remaining</AppText>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <AmountInput
                  label="Monthly Payment"
                  value={monthlyPayment}
                  onChange={setMonthlyPayment}
                  error={errors.monthlyPayment}
                />
                <AppTextInput
                  label="Term (months)"
                  value={termMonths}
                  onChangeText={setTermMonths}
                  placeholder="e.g. 12"
                  error={errors.termMonths}
                  numeric
                />
                <AmountInput
                  label="Monthly Interest (optional)"
                  value={monthlyInterest}
                  onChange={setMonthlyInterest}
                />
                <AmountInput
                  label="Other Fees (optional)"
                  value={installmentFee}
                  onChange={setInstallmentFee}
                />
              </>
            )}
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

const useStyles = makeStyles((c) => ({
  preview: { gap: theme.spacing[1], padding: theme.spacing[4], borderRadius: theme.radius.md, backgroundColor: c.bgElevated },
  form: { gap: theme.spacing[5] },
  dateWrapper: {},
  clearDate: { paddingTop: theme.spacing[2] },
  setDateBtn: { gap: theme.spacing[1] },
  setDateRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  installmentRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] },
  flex: { flex: 1, gap: theme.spacing[1] },
  bottomPad: { height: theme.spacing[5] },
}));
