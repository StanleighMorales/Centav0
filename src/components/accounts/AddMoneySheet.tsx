import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AmountInput } from '../ui/AmountInput';
import { AppTextInput } from '../ui/AppTextInput';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { categoryRepo, transactionRepo } from '../../repositories';
import { nowIso } from '../../utils/date';
import { theme } from '../../theme';
import type { Account, Category } from '../../domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  account: Account | null;
};

// Adds money to an account by recording it as a normal Income transaction,
// so the top-up shows up in history and reports (per product decision).
export function AddMoneySheet({ visible, onClose, onSuccess, account }: Props) {
  const [amount, setAmount] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) {
      setAmount(0);
      setNote('');
      setErrors({});
      return;
    }
    (async () => {
      const cats = (await categoryRepo.list()).filter((c) => c.type === 'Income');
      setCategories(cats);
      setCategoryId((prev) => prev ?? cats[0]?.id ?? null);
    })();
  }, [visible]);

  async function handleSave() {
    if (!account) return;
    const errs: Record<string, string> = {};
    if (amount <= 0) errs.amount = 'Enter an amount';
    if (!categoryId) errs.categoryId = 'Select a category';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      await transactionRepo.create({
        date: nowIso(),
        amount,
        type: 'Income',
        categoryId: categoryId!,
        accountId: account.id,
        note: note.trim() || undefined,
      });
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Add Money${account ? ` to ${account.name}` : ''}`}>
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AmountInput label="Amount" value={amount} onChange={setAmount} error={errors.amount} />
        <Select
          label="Category"
          options={categories.map((c) => ({ label: c.name, value: c.id }))}
          value={categoryId}
          onChange={setCategoryId}
          error={errors.categoryId}
          placeholder={categories.length === 0 ? 'No income categories yet' : 'Select…'}
        />
        <AppTextInput
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Top-up, deposit…"
        />
        <Button label="Add Money" onPress={handleSave} loading={saving} />
        <View style={styles.bottomPad} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing[5] },
  bottomPad: { height: theme.spacing[5] },
});
