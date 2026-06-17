import React, { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AmountInput } from '../ui/AmountInput';
import { AppTextInput } from '../ui/AppTextInput';
import { Select } from '../ui/Select';
import { DatePicker } from '../ui/DatePicker';
import { Button } from '../ui/Button';
import { AppText } from '../ui/AppText';
import { accountRepo, categoryRepo, transactionRepo } from '../../repositories';
import { nowIso } from '../../utils/date';
import { theme } from '../../theme';
import type { Account, Category, TransactionType } from '../../domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddTransactionSheet({ visible, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState(0);
  const [type, setType] = useState<TransactionType>('Expense');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(nowIso());
  const [note, setNote] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const cats = await categoryRepo.list();
      const accs = await accountRepo.list();
      setCategories(cats);
      setAccounts(accs);
      if (accs.length > 0 && !accountId) setAccountId(accs[0].id);
    })();
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setAmount(0);
      setType('Expense');
      setCategoryId(null);
      setDate(nowIso());
      setNote('');
      setErrors({});
    }
  }, [visible]);

  const filteredCategories = categories.filter((c) => c.type === type);

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (amount <= 0) errs.amount = 'Enter an amount';
    if (!categoryId) errs.categoryId = 'Select a category';
    if (!accountId) errs.accountId = 'Select an account';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      await transactionRepo.create({
        date, amount, type,
        categoryId: categoryId!,
        accountId: accountId!,
        note: note.trim() || undefined,
      });
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Transaction">
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.typeRow}>
          {(['Expense', 'Income'] as TransactionType[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => { setType(t); setCategoryId(null); }}
              accessibilityRole="button"
              accessibilityLabel={t}
              style={[styles.typeBtn, type === t && styles.typeBtnActive]}
            >
              <AppText variant="labelLg" color={type === t ? 'bgPrimary' : 'textSecondary'}>
                {t}
              </AppText>
            </Pressable>
          ))}
        </View>

        <AmountInput label="Amount" value={amount} onChange={setAmount} error={errors.amount} />
        <Select
          label="Category"
          options={filteredCategories.map((c) => ({ label: c.name, value: c.id }))}
          value={categoryId}
          onChange={setCategoryId}
          error={errors.categoryId}
          placeholder={filteredCategories.length === 0 ? 'No categories yet' : 'Select…'}
        />
        <Select
          label="Account"
          options={accounts.map((a) => ({ label: a.name, value: a.id }))}
          value={accountId}
          onChange={setAccountId}
          error={errors.accountId}
        />
        <DatePicker label="Date" value={date} onChange={setDate} />
        <AppTextInput
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Add a note…"
        />
        <Button label="Save Transaction" onPress={handleSave} loading={saving} />
        <View style={styles.bottomPad} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing[5] },
  typeRow: {
    flexDirection: 'row',
    gap: theme.spacing[3],
  },
  typeBtn: {
    flex: 1,
    paddingVertical: theme.spacing[3],
    alignItems: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  typeBtnActive: {
    backgroundColor: theme.colors.accentPrimary,
    borderColor: theme.colors.accentPrimary,
  },
  bottomPad: { height: theme.spacing[5] },
});
