import React, { useState, useEffect } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AmountInput } from '../ui/AmountInput';
import { AppTextInput } from '../ui/AppTextInput';
import { Select } from '../ui/Select';
import { DatePicker } from '../ui/DatePicker';
import { Button } from '../ui/Button';
import { AppText } from '../ui/AppText';
import { accountRepo, categoryRepo, recurringTransactionRepo } from '../../repositories';
import { nowIso } from '../../utils/date';
import { theme, makeStyles } from '../../theme';
import type { Account, Category, RecurringTransaction, RecurringFrequency } from '../../domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initial?: RecurringTransaction;
};

const FREQUENCIES: { value: RecurringFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'semi-monthly', label: 'Semi-monthly' },
  { value: 'weekly', label: 'Weekly' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Semi-monthly always means "15th and last day" — the overwhelmingly common
// Philippine payroll pattern — so there's no separate day-picker UI for it.
const SEMI_MONTH_DAYS = [15, 30];

export function AddRecurringSheet({ visible, onClose, onSuccess, initial }: Props) {
  const styles = useStyles();
  const isEdit = Boolean(initial);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<'Expense' | 'Income'>('Expense');
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [startDate, setStartDate] = useState(nowIso());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;
    accountRepo.list().then(setAccounts);
    categoryRepo.list(initial?.type ?? type).then(setCategories);
    setType(initial?.type ?? 'Expense');
    setAmount(initial?.amount ?? 0);
    setAccountId(initial?.accountId ?? null);
    setCategoryId(initial?.categoryId ?? null);
    setNote(initial?.note ?? '');
    setFrequency(initial?.frequency ?? 'monthly');
    setDayOfMonth(String(initial?.dayOfMonth ?? 1));
    setDayOfWeek(initial?.dayOfWeek ?? 0);
    setStartDate(initial?.startDate ?? nowIso());
    setErrors({});
  }, [visible]);

  useEffect(() => {
    if (visible) categoryRepo.list(type).then(setCategories);
  }, [type]);

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (amount <= 0) errs.amount = 'Enter an amount';
    if (!accountId) errs.account = 'Select an account';
    if (frequency === 'monthly' && (Number(dayOfMonth) < 1 || Number(dayOfMonth) > 31)) {
      errs.dayOfMonth = 'Day must be 1-31';
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const input = {
      amount, type, accountId: accountId!, categoryId: categoryId ?? undefined,
      note: note.trim() || undefined, frequency, startDate,
      dayOfMonth: frequency === 'monthly' ? Number(dayOfMonth) : null,
      semiMonthDays: frequency === 'semi-monthly' ? SEMI_MONTH_DAYS : null,
      dayOfWeek: frequency === 'weekly' ? dayOfWeek : null,
    };
    setSaving(true);
    try {
      if (isEdit && initial) {
        await recurringTransactionRepo.update(initial.id, input);
      } else {
        await recurringTransactionRepo.create(input);
      }
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const accountOptions = accounts.map((a) => ({ label: a.name, value: a.id }));
  const categoryOptions = categories.map((c) => ({ label: c.name, value: c.id }));

  return (
    <BottomSheet visible={visible} onClose={onClose} title={isEdit ? 'Edit Recurring' : 'Add Recurring'}>
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.toggleRow}>
          {(['Expense', 'Income'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              accessibilityRole="button"
              accessibilityLabel={t}
              style={[styles.toggleBtn, type === t && styles.toggleBtnActive]}
            >
              <AppText variant="labelLg" color={type === t ? 'bgPrimary' : 'textSecondary'}>{t}</AppText>
            </Pressable>
          ))}
        </View>

        <AmountInput label="Amount" value={amount} onChange={setAmount} error={errors.amount} />
        <Select label="Account" options={accountOptions} value={accountId} onChange={setAccountId} error={errors.account} />
        <Select label="Category" options={categoryOptions} value={categoryId} onChange={setCategoryId} placeholder="Optional" />
        <AppTextInput label="Note" value={note} onChangeText={setNote} placeholder="e.g. Salary, Rent, Netflix" />

        <View>
          <AppText variant="labelLg" color="textSecondary" style={styles.sectionLabel}>Frequency</AppText>
          <View style={styles.toggleRow}>
            {FREQUENCIES.map((f) => (
              <Pressable
                key={f.value}
                onPress={() => setFrequency(f.value)}
                accessibilityRole="button"
                accessibilityLabel={f.label}
                style={[styles.toggleBtn, frequency === f.value && styles.toggleBtnActive]}
              >
                <AppText variant="labelSm" color={frequency === f.value ? 'bgPrimary' : 'textSecondary'}>
                  {f.label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>

        {frequency === 'monthly' ? (
          <AppTextInput
            label="Day of month"
            value={dayOfMonth}
            onChangeText={setDayOfMonth}
            numeric
            error={errors.dayOfMonth}
          />
        ) : null}

        {frequency === 'semi-monthly' ? (
          <AppText variant="bodySm" color="textSecondary">Posts on the 15th and the last day of every month.</AppText>
        ) : null}

        {frequency === 'weekly' ? (
          <View>
            <AppText variant="labelLg" color="textSecondary" style={styles.sectionLabel}>Day of week</AppText>
            <View style={styles.weekRow}>
              {WEEKDAYS.map((label, i) => (
                <Pressable
                  key={label}
                  onPress={() => setDayOfWeek(i)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  style={[styles.dayBtn, dayOfWeek === i && styles.toggleBtnActive]}
                >
                  <AppText variant="labelSm" color={dayOfWeek === i ? 'bgPrimary' : 'textSecondary'}>{label}</AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <DatePicker label="Starts on" value={startDate} onChange={setStartDate} />

        <Button label={isEdit ? 'Save Changes' : 'Add Recurring'} onPress={handleSave} loading={saving} />
        <View style={styles.bottomPad} />
      </ScrollView>
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
  form: { gap: theme.spacing[5] },
  sectionLabel: { marginBottom: theme.spacing[3] },
  toggleRow: { flexDirection: 'row', gap: theme.spacing[3] },
  toggleBtn: {
    flex: 1,
    paddingVertical: theme.spacing[3],
    alignItems: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.borderDefault,
  },
  toggleBtnActive: {
    backgroundColor: c.accentPrimary,
    borderColor: c.accentPrimary,
  },
  weekRow: { flexDirection: 'row', gap: theme.spacing[2] },
  dayBtn: {
    flex: 1,
    paddingVertical: theme.spacing[3],
    alignItems: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.borderDefault,
  },
  bottomPad: { height: theme.spacing[5] },
}));
