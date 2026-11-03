import React, { useState, useEffect } from 'react';
import { View, Pressable, Image, ActivityIndicator } from 'react-native';
import { SheetScrollView as ScrollView } from '../ui/BottomSheet';
import { Feather } from '@expo/vector-icons';
import { Segmented } from '../ui/Segmented';
import { BottomSheet } from '../ui/BottomSheet';
import { AmountInput } from '../ui/AmountInput';
import { AppTextInput } from '../ui/AppTextInput';
import { Select } from '../ui/Select';
import { DatePicker } from '../ui/DatePicker';
import { Button } from '../ui/Button';
import { AppText } from '../ui/AppText';
import { ReceiptItemsEditor } from '../transactions/ReceiptItemsEditor';
import { CategorySheet } from '../categories/CategorySheet';
import { AddAccountSheet } from '../accounts/AddAccountSheet';
import { VoiceInputButton } from './VoiceInputButton';
import { parseVoiceCommand, parseVoiceTransaction, type VoiceCommand } from '../../utils/voiceTransaction';
import { accountRepo, categoryRepo, debtRepo, transactionRepo, transactionItemRepo } from '../../repositories';
import { nowIso } from '../../utils/date';
import { scanReceipt } from '../../utils/receiptScan';
import { formatPHP } from '../../utils/currency';
import { ACCUMULATED_ID, accumulatedTotal, splitAcrossAccounts } from '../../utils/accumulated';
import { theme, makeStyles, useTheme } from '../../theme';
import type { Account, Category, Debt, Transaction, TransactionItemInput } from '../../domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initial?: Transaction | null;
  lockAccountAndType?: boolean;
  /** Fast dial: start listening or open the camera as soon as the sheet opens. */
  autoStart?: 'voice' | 'camera' | null;
  /** Spoken transfers and debt payments go here instead of prefilling this form. The sheet closes itself. */
  onVoiceCommand?: (cmd: Exclude<VoiceCommand, { kind: 'transaction' }>) => void;
};

const TYPES = ['Expense', 'Income'] as const;

export function AddTransactionSheet({ visible, onClose, onSuccess, initial, lockAccountAndType, autoStart, onVoiceCommand }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [amount, setAmount] = useState(0);
  // AddTransactionSheet only ever toggles Expense/Income — Transfer has its own TransferSheet.
  const [type, setType] = useState<'Expense' | 'Income'>('Expense');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(nowIso());
  const [note, setNote] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categorySheetVisible, setCategorySheetVisible] = useState(false);
  const [accountSheetVisible, setAccountSheetVisible] = useState(false);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [items, setItems] = useState<TransactionItemInput[]>([]);
  const [scanning, setScanning] = useState(false);

  async function handleScan(source: 'camera' | 'gallery') {
    setScanning(true);
    try {
      const res = await scanReceipt(source);
      if (!res) return;
      const { uri, parsed } = res;
      setReceiptUri(uri);
      // Nothing parsed leaves the fields as they were: the photo is attached and saving is never blocked.
      if (parsed.total != null) setAmount(parsed.total);
      if (parsed.date) setDate(parsed.date);
      if (parsed.merchant) setNote(parsed.merchant);
      setItems(parsed.items);
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const cats = await categoryRepo.list();
      const accs = await accountRepo.list();
      setCategories(cats);
      setAccounts(accs);
      if (onVoiceCommand) setDebts(await debtRepo.list());
      if (initial) {
        setAmount(initial.amount);
        setType(initial.type as 'Expense' | 'Income');
        setCategoryId(initial.categoryId);
        setAccountId(initial.accountId);
        setDate(initial.date);
        setNote(initial.note ?? '');
        setReceiptUri(initial.receiptUri);
        setItems((await transactionItemRepo.listByTransaction(initial.id)).map(({ name, qty, price }) => ({ name, qty, price })));
      } else if (accs.length > 0) {
        setAccountId(accs[0].id);
      }
    })();
  }, [visible, initial]);

  useEffect(() => {
    if (visible && autoStart === 'camera') handleScan('camera');
  }, [visible, autoStart]);

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
      setItems([]);
      setErrors({});
    }
  }, [visible, initial]);

  function changeType(t: 'Expense' | 'Income') {
    setType(t);
    setCategoryId(null);
    if (t === 'Income' && accountId === ACCUMULATED_ID) setAccountId(accounts[0]?.id ?? null);
  }

  // Voice only prefills the form; the user still reviews and taps Save.
  function applyVoice(text: string) {
    if (onVoiceCommand) {
      const cmd = parseVoiceCommand(text, accounts, debts);
      if (cmd.kind !== 'transaction') { onClose(); onVoiceCommand(cmd); return; }
    }
    const parsed = parseVoiceTransaction(text, categories, lockAccountAndType ? type : undefined, accounts);
    changeType(parsed.type);
    if (parsed.accountId && !lockAccountAndType) setAccountId(parsed.accountId);
    if (parsed.amount) setAmount(parsed.amount);
    setCategoryId(parsed.categoryId);
    if (parsed.note) setNote(parsed.note);
    setErrors({});
  }

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
      } else {
        const saved = initial
          ? await transactionRepo.update(initial.id, { ...base, amount, accountId: accountId! })
          : await transactionRepo.create({ ...base, amount, accountId: accountId! });
        // Items only belong to a receipt-bearing expense; blank rows are dropped.
        const kept = type === 'Expense' ? items.filter((i) => i.name.trim()) : [];
        if (initial || kept.length > 0) await transactionItemRepo.replaceForTransaction(saved.id, kept);
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
        {initial ? null : (
          <VoiceInputButton
            onResult={applyVoice}
            autoStart={autoStart === 'voice'}
            names={[...accounts.map((a) => a.name), ...debts.map((d) => d.creditor)]}
          />
        )}

        {lockAccountAndType ? null : (
          <Segmented options={TYPES} value={type} onChange={changeType} />
        )}

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
            <Feather name="plus" size={20} color={colors.accentPrimary} />
          </Pressable>
        </View>
        {lockAccountAndType ? null : (
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
              <Feather name="plus" size={20} color={colors.accentPrimary} />
            </Pressable>
          </View>
        )}
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
                  onPress={() => { setReceiptUri(null); setItems([]); }}
                  accessibilityRole="button"
                  accessibilityLabel="Remove receipt"
                  style={styles.receiptRemove}
                >
                  <Feather name="x" size={16} color={colors.textPrimary} />
                </Pressable>
              </View>
            ) : scanning ? (
              <View style={styles.receiptAttach}>
                <ActivityIndicator color={colors.accentPrimary} />
                <AppText variant="body" color="textSecondary">Reading receipt...</AppText>
              </View>
            ) : (
              <View style={styles.scanRow}>
                <Pressable
                  onPress={() => handleScan('camera')}
                  accessibilityRole="button"
                  accessibilityLabel="Scan receipt with camera"
                  style={[styles.receiptAttach, styles.scanBtn]}
                >
                  <Feather name="camera" size={18} color={colors.accentPrimary} />
                  <AppText variant="body" color="accentPrimary">Scan receipt</AppText>
                </Pressable>
                <Pressable
                  onPress={() => handleScan('gallery')}
                  accessibilityRole="button"
                  accessibilityLabel="Pick receipt from gallery"
                  style={[styles.receiptAttach, styles.scanBtn]}
                >
                  <Feather name="image" size={18} color={colors.accentPrimary} />
                  <AppText variant="body" color="accentPrimary">Gallery</AppText>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}
        {type === 'Expense' && (receiptUri || items.length > 0) ? (
          <ReceiptItemsEditor items={items} onChange={setItems} total={amount} />
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

const useStyles = makeStyles((c) => ({
  form: { gap: theme.spacing[5] },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing[3],
  },
  pickerFlex: { flex: 1 },
  receiptSection: { gap: theme.spacing[2] },
  scanRow: { flexDirection: 'row', gap: theme.spacing[3] },
  scanBtn: { flex: 1, justifyContent: 'center' },
  receiptAttach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    paddingVertical: theme.spacing[4],
    paddingHorizontal: theme.spacing[5],
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: c.accentBorder,
    backgroundColor: c.accentSubtle,
  },
  receiptPreview: { position: 'relative' },
  receiptImage: {
    width: '100%',
    height: 160,
    borderRadius: theme.radius.md,
    backgroundColor: c.bgElevated,
  },
  receiptRemove: {
    position: 'absolute',
    top: theme.spacing[3],
    right: theme.spacing[3],
    width: 28,
    height: 28,
    borderRadius: theme.radius.full,
    backgroundColor: c.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBtn: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: c.accentBorder,
    backgroundColor: c.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomPad: { height: theme.spacing[5] },
}));
