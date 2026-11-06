import React, { useState, useEffect } from 'react';
import { View, Pressable, Switch } from 'react-native';
import { SheetScrollView as ScrollView } from '../ui/BottomSheet';
import { useRouter } from 'expo-router';
import { BottomSheet } from '../ui/BottomSheet';
import { AppTextInput } from '../ui/AppTextInput';
import { AppText } from '../ui/AppText';
import { Select } from '../ui/Select';
import { AmountInput } from '../ui/AmountInput';
import { Button } from '../ui/Button';
import { accountRepo, accountTypeRepo, categoryRepo, transactionRepo } from '../../repositories';
import { balanceAdjustment } from '../../utils/accounts';
import { nowIso } from '../../utils/date';
import { theme, makeStyles, useTheme } from '../../theme';
import type { Account, AccountType as AccountTypeEntity, CategoryType } from '../../domain/types';

function parseDay(value: string): number | undefined {
  const day = parseInt(value, 10);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : undefined;
}

// ponytail: same lazy get-or-create as the Loan category in SqliteDebtRepository.
async function adjustmentCategoryId(type: CategoryType): Promise<string> {
  const existing = (await categoryRepo.list(type)).find((c) => c.name === ADJUSTMENT_CATEGORY);
  if (existing) return existing.id;
  const created = await categoryRepo.create({
    name: ADJUSTMENT_CATEGORY, type, icon: 'sliders', color: '#64748b',
  });
  return created.id;
}

const ADJUSTMENT_CATEGORY = 'Balance Adjustment';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initial?: Account;
  /** Ledger's Credit tab: only credit types, titled as a credit line. */
  creditOnly?: boolean;
};

export function AddAccountSheet({ visible, onClose, onSuccess, initial, creditOnly }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [name, setName] = useState('');
  const [accountTypeId, setAccountTypeId] = useState('');
  const [accountTypes, setAccountTypes] = useState<AccountTypeEntity[]>([]);
  const [balance, setBalance] = useState(0);
  const [billDay, setBillDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [creditLimit, setCreditLimit] = useState(0);
  const [billDayNext, setBillDayNext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setAccountTypeId(initial?.accountTypeId ?? '');
      setBalance(initial ? initial.currentBalance : 0);
      setBillDay(initial?.billDay != null ? String(initial.billDay) : '');
      setDueDay(initial?.dueDay != null ? String(initial.dueDay) : '');
      setCreditLimit(initial?.creditLimit ?? 0);
      setBillDayNext(initial?.billDayNextStatement ?? false);
      setErrors({});
      accountTypeRepo.list().then((all) => {
        const types = creditOnly ? all.filter((t) => t.allowsOverdraft) : all;
        setAccountTypes(types);
        if (!initial && types.length > 0) setAccountTypeId(types[0].id);
      });
    }
  }, [visible]);

  const allowsOverdraft = accountTypes.find((t) => t.id === accountTypeId)?.allowsOverdraft ?? false;

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Enter an account name';
    if (!accountTypeId) errs.accountTypeId = 'Select a type';
    if (allowsOverdraft && billDay.trim() && !parseDay(billDay)) errs.billDay = 'Enter a day between 1 and 31';
    if (allowsOverdraft && dueDay.trim() && !parseDay(dueDay)) errs.dueDay = 'Enter a day between 1 and 31';
    if (allowsOverdraft && !isEdit && creditLimit <= 0) errs.creditLimit = 'Enter the card\'s max balance';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      const cardFields = {
        billDay: allowsOverdraft ? parseDay(billDay) : undefined,
        dueDay: allowsOverdraft ? parseDay(dueDay) : undefined,
        creditLimit: allowsOverdraft && creditLimit > 0 ? creditLimit : undefined,
        billDayNextStatement: allowsOverdraft ? billDayNext : undefined,
      };
      if (initial) {
        await accountRepo.update(initial.id, { name: name.trim(), accountTypeId, ...cardFields });
        // Balance is computed from transactions, so correct it with one, not a direct write.
        const adjustment = balanceAdjustment(initial.currentBalance, balance);
        if (adjustment) {
          await transactionRepo.create({
            date: nowIso(),
            amount: adjustment.amount,
            type: adjustment.type,
            categoryId: await adjustmentCategoryId(adjustment.type),
            accountId: initial.id,
            note: ADJUSTMENT_CATEGORY,
          });
        }
      } else {
        await accountRepo.create({ name: name.trim(), accountTypeId, initialBalance: balance, ...cardFields });
      }
      onSuccess();
      onClose();
    } catch (e) {
      setErrors({ balance: e instanceof Error ? e.message : 'Could not save account' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={isEdit ? 'Edit Account' : creditOnly ? 'Add Credit Line' : 'Add Account'}
    >
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppTextInput
          label="Account Name"
          value={name}
          onChangeText={setName}
          placeholder={creditOnly ? 'e.g. Atome Credit' : 'e.g. BDO Savings'}
          error={errors.name}
        />
        <Select
          label="Type"
          options={accountTypes.map((t) => ({ label: t.name, value: t.id }))}
          value={accountTypeId || null}
          onChange={setAccountTypeId}
          error={errors.accountTypeId}
        />
        <Pressable
          onPress={() => { onClose(); router.push('/account-types'); }}
          accessibilityRole="button"
          accessibilityLabel="Manage account types"
          style={styles.manageTypesBtn}
        >
          <AppText variant="bodySm" color="accentPrimary">Manage types</AppText>
        </Pressable>
        {allowsOverdraft && (
          <>
            <AppTextInput
              label="Bill Date (day of month, optional)"
              value={billDay}
              onChangeText={setBillDay}
              placeholder="e.g. 15"
              numeric
              error={errors.billDay}
            />
            <AppTextInput
              label="Due Date (day of month, optional)"
              value={dueDay}
              onChangeText={setDueDay}
              placeholder="e.g. 3"
              numeric
              error={errors.dueDay}
            />
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <AppText variant="labelLg" color="textSecondary">Bill-date purchases go on next bill</AppText>
                <AppText variant="bodySm" color="textMuted">
                  {billDayNext ? 'Buying on the bill date rolls to next month' : 'Buying on the bill date is on that day\'s bill'}
                </AppText>
              </View>
              <Switch
                value={billDayNext}
                onValueChange={setBillDayNext}
                accessibilityLabel="Purchases on the bill date go on the next bill"
                trackColor={{ false: colors.borderStrong, true: colors.accentDim }}
                thumbColor={billDayNext ? colors.accentPrimary : colors.textMuted}
              />
            </View>
            {isEdit ? null : (
              <AmountInput
                label="Max Balance"
                value={creditLimit}
                onChange={setCreditLimit}
                error={errors.creditLimit}
              />
            )}
          </>
        )}
        {isEdit ? (
          <>
            <AmountInput
              label={allowsOverdraft ? 'Available Balance' : 'Current Balance'}
              value={balance}
              onChange={setBalance}
              error={errors.balance}
            />
            <AppText variant="bodySm" color="textMuted">
              Changing this records a "{ADJUSTMENT_CATEGORY}" transaction so the change stays traceable.
            </AppText>
          </>
        ) : allowsOverdraft ? null : (
          <AmountInput label="Initial Balance" value={balance} onChange={setBalance} />
        )}
        <Button label={isEdit ? 'Save Changes' : 'Add Account'} onPress={handleSave} loading={saving} />
        <View style={styles.bottomPad} />
      </ScrollView>
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
  form: { gap: theme.spacing[5] },
  manageTypesBtn: { alignSelf: 'flex-start' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] },
  flex: { flex: 1, gap: theme.spacing[1] },
  bottomPad: { height: theme.spacing[5] },
}));
