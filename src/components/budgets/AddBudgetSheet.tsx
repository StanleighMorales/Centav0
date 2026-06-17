import React, { useState, useEffect } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AmountInput } from '../ui/AmountInput';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { AppText } from '../ui/AppText';
import { allocationRepo, categoryRepo } from '../../repositories';
import { theme } from '../../theme';
import { nowIso } from '../../utils/date';
import type { Category, AllocationPeriod, Allocation } from '../../domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initial?: Allocation;
};

export function AddBudgetSheet({ visible, onClose, onSuccess, initial }: Props) {
  const isEdit = Boolean(initial);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [period, setPeriod] = useState<AllocationPeriod>('Monthly');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      categoryRepo.list('Expense').then(setCategories);
      setCategoryId(initial?.categoryId ?? null);
      setAmount(initial?.amount ?? 0);
      setPeriod(initial?.period ?? 'Monthly');
      setErrors({});
    }
  }, [visible]);

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!categoryId) errs.category = 'Select a category';
    if (amount <= 0) errs.amount = 'Enter a budget amount';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      if (isEdit && initial) {
        await allocationRepo.update(initial.id, { amount, period, startDate: initial.startDate });
      } else {
        await allocationRepo.create({
          categoryId: categoryId!,
          amount,
          period,
          startDate: nowIso().slice(0, 10),
        });
      }
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const categoryOptions = categories.map((c) => ({ label: c.name, value: c.id }));

  return (
    <BottomSheet visible={visible} onClose={onClose} title={isEdit ? 'Edit Budget' : 'Add Budget'}>
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Select
          label="Category"
          options={categoryOptions}
          value={categoryId}
          onChange={setCategoryId}
          placeholder="Select expense category…"
          error={errors.category}
        />
        <AmountInput label="Budget Amount" value={amount} onChange={setAmount} error={errors.amount} />
        <View>
          <AppText variant="labelLg" color="textSecondary" style={styles.periodLabel}>Period</AppText>
          <View style={styles.periodRow}>
            {(['Monthly', 'Weekly'] as AllocationPeriod[]).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                accessibilityRole="button"
                accessibilityLabel={p}
                style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              >
                <AppText variant="labelLg" color={period === p ? 'bgPrimary' : 'textSecondary'}>
                  {p}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
        <Button label={isEdit ? 'Save Changes' : 'Add Budget'} onPress={handleSave} loading={saving} />
        <View style={styles.bottomPad} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing[5] },
  periodLabel: { marginBottom: theme.spacing[3] },
  periodRow: { flexDirection: 'row', gap: theme.spacing[3] },
  periodBtn: {
    flex: 1,
    paddingVertical: theme.spacing[3],
    alignItems: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  periodBtnActive: {
    backgroundColor: theme.colors.accentPrimary,
    borderColor: theme.colors.accentPrimary,
  },
  bottomPad: { height: theme.spacing[5] },
});
