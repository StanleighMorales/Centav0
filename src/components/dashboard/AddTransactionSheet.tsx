import React, { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { BottomSheet } from '../ui/BottomSheet';
import { AmountInput } from '../ui/AmountInput';
import { AppTextInput } from '../ui/AppTextInput';
import { Select } from '../ui/Select';
import { DatePicker } from '../ui/DatePicker';
import { Button } from '../ui/Button';
import { AppText } from '../ui/AppText';
import { CategorySheet } from '../categories/CategorySheet';
import { AddAccountSheet } from '../accounts/AddAccountSheet';
import { accountRepo, categoryRepo, transactionRepo } from '../../repositories';
import { nowIso } from '../../utils/date';
import { formatPHP } from '../../utils/currency';
import { ACCUMULATED_ID, accumulatedTotal, splitAcrossAccounts } from '../../utils/accumulated';
import { theme } from '../../theme';
import type { Account, Category, Transaction, TransactionType } from '../../domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initial?: Transaction | null;
};

export function AddTransactionSheet({ visible, onClose, onSuccess, initial }: Props) {
  const [amount, setAmount] = useState(0);
  // AddTransactionSheet only ever toggles Expense/Income — Transfer has its own TransferSheet.
  const [type, setType] = useState<'Expense' | 'Income'>('Expense');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(nowIso());
  const [note, setNote] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categorySheetVisible, setCategorySheetVisible] = useState(false);
  const [accountSheetVisible, setAccountSheetVisible] = useState(false);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  async function pickReceipt() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) setReceiptUri(result.assets[0].uri);
  }

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const cats = await categoryRepo.list();
      const accs = await accountRepo.list();
      setCategories(cats);
      setAccounts(accs);
      if (initial) {
        setAmount(initial.amount);
        setType(initial.type as 'Expense' | 'Income');
        setCategoryId(initial.categoryId);
        setAccountId(initial.accountId);
        setDate(initial.date);
        setNote(initial.note ?? '');
        setReceiptUri(initial.receiptUri);
      } else if (accs.length > 0) {
        setAccountId(accs[0].id);
      }
    })();
  }, [visible, initial]);

  // After inline-creating a category/account, reload and auto-select the new one.
  async function reloadCategoriesSelectNew() {
    const before = new Set(categories.map((c) => c.id));
    const cats = await categoryRepo.list();
    setCategories(cats);
    const added = cats.find((c) => !before.has(c.id));
    if (added) { setType(added.type); setCategoryId(added.id); }
  }

  async function reloadAccountsSelectNew() {
    const before = new Set(accounts.map((a) => a.id));
    const accs = await accountRepo.list();
    setAccounts(accs);
    const added = accs.find((a) => !before.has(a.id));
    if (added) setAccountId(added.id);
  }

  useEffect(() => {
    if (!visible) {
      setAmount(0);
      setType('Expense');
      setCategoryId(null);
      setDate(nowIso());
      setNote('');
      setReceiptUri(null);
      setErrors({});
    }
  }, [visible, initial]);

  const filteredCategories = categories.filter((c) => c.type === type);
  const isAccumulated = accountId === ACCUMULATED_ID;
  // Accumulated Balance is a virtual source: new expenses only, split across real accounts.
  const allowAccumulated = type === 'Expense' && !initial;

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (amount <= 0) errs.amount = 'Enter an amount';
    if (!categoryId) errs.categoryId = 'Select a category';
    if (!accountId) errs.accountId = 'Select an account';
    if (isAccumulated && amount > accumulatedTotal(accounts)) {
      errs.accountId = `Only ${formatPHP(accumulatedTotal(accounts))} available across accounts`;
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const base = {
        date, type,
        categoryId: categoryId!,
        note: note.trim() || undefined,
        receiptUri: type === 'Expense' ? receiptUri ?? undefined : undefined,
      };
      if (isAccumulated) {
        const portions = splitAcrossAccounts(accounts, amount);
        if (!portions) { setErrors({ accountId: 'Not enough accumulated balance' }); return; }
        for (const p of portions) {
          await transactionRepo.create({ ...base, amount: p.amount, accountId: p.account.id });
        }
      } else if (initial) {
        await transactionRepo.update(initial.id, { ...base, amount, accountId: accountId! });
      } else {
        await transactionRepo.create({ ...base, amount, accountId: accountId! });
      }
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={initial ? 'Edit Transaction' : 'Add Transaction'}>
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.typeRow}>
          {(['Expense', 'Income'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                setType(t);
                setCategoryId(null);
                if (t === 'Income' && accountId === ACCUMULATED_ID) setAccountId(accounts[0]?.id ?? null);
              }}
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
        <View style={styles.pickerRow}>
          <View style={styles.pickerFlex}>
            <Select
              label="Category"
              options={filteredCategories.map((c) => ({ label: c.name, value: c.id }))}
              value={categoryId}
              onChange={setCategoryId}
              error={errors.categoryId}
              placeholder={filteredCategories.length === 0 ? 'No categories yet' : 'Select...'}
            />
          </View>
          <Pressable
            onPress={() => setCategorySheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Add new category"
            style={styles.plusBtn}
          >
            <Feather name="plus" size={20} color={theme.colors.accentPrimary} />
          </Pressable>
        </View>
        <View style={styles.pickerRow}>
          <View style={styles.pickerFlex}>
            <Select
              label="Account"
              options={[
                ...(allowAccumulated
                  ? [{ label: `Accumulated Balance (${formatPHP(accumulatedTotal(accounts))})`, value: ACCUMULATED_ID }]
                  : []),
                ...accounts.map((a) => ({ label: a.name, value: a.id })),
              ]}
              value={accountId}
              onChange={setAccountId}
              error={errors.accountId}
            />
          </View>
          <Pressable
            onPress={() => setAccountSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Add new account"
            style={styles.plusBtn}
          >
            <Feather name="plus" size={20} color={theme.colors.accentPrimary} />
          </Pressable>
        </View>
        <DatePicker label="Date" value={date} onChange={setDate} />
        <AppTextInput
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Add a note..."
        />
        {type === 'Expense' ? (
          <View style={styles.receiptSection}>
            <AppText variant="labelLg" color="textSecondary">Receipt (optional)</AppText>
            {receiptUri ? (
              <View style={styles.receiptPreview}>
                <Image source={{ uri: receiptUri }} style={styles.receiptImage} resizeMode="cover" />
                <Pressable
                  onPress={() => setReceiptUri(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove receipt"
                  style={styles.receiptRemove}
                >
                  <Feather name="x" size={16} color={theme.colors.textPrimary} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={pickReceipt}
                accessibilityRole="button"
                accessibilityLabel="Attach receipt image"
                style={styles.receiptAttach}
              >
                <Feather name="paperclip" size={18} color={theme.colors.accentPrimary} />
                <AppText variant="body" color="accentPrimary">Attach image</AppText>
              </Pressable>
            )}
          </View>
        ) : null}
        <Button label={initial ? 'Save Changes' : 'Save Transaction'} onPress={handleSave} loading={saving} />
        <View style={styles.bottomPad} />
      </ScrollView>

      <CategorySheet
        visible={categorySheetVisible}
        onClose={() => setCategorySheetVisible(false)}
        onSuccess={reloadCategoriesSelectNew}
        defaultType={type}
      />
      <AddAccountSheet
        visible={accountSheetVisible}
        onClose={() => setAccountSheetVisible(false)}
        onSuccess={reloadAccountsSelectNew}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing[5] },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing[3],
  },
  pickerFlex: { flex: 1 },
  receiptSection: { gap: theme.spacing[2] },
  receiptAttach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    paddingVertical: theme.spacing[4],
    paddingHorizontal: theme.spacing[5],
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    backgroundColor: theme.colors.accentSubtle,
  },
  receiptPreview: { position: 'relative' },
  receiptImage: {
    width: '100%',
    height: 160,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
  },
  receiptRemove: {
    position: 'absolute',
    top: theme.spacing[3],
    right: theme.spacing[3],
    width: 28,
    height: 28,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBtn: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    backgroundColor: theme.colors.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
