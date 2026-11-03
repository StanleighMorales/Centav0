import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BottomSheet, SheetScrollView as ScrollView } from '../ui/BottomSheet';
import { AppText } from '../ui/AppText';
import { AppTextInput } from '../ui/AppTextInput';
import { Chip } from '../ui/Chip';
import { Button } from '../ui/Button';
import { accountRepo } from '../../repositories';
import { displayDate, nowIso } from '../../utils/date';
import { formatPHP } from '../../utils/currency';
import { firstBillOptions } from '../../utils/creditStatements';
import { theme, makeStyles } from '../../theme';
import type { Account } from '../../domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  account: Account;
  amount: number;
  /** Still owed of `amount`. */
  remaining: number;
  /** Opens Pay with the remaining amount filled in. */
  onPay: () => void;
};

// What a credit line owes beyond recorded purchases: how many months are left on it, and which bill it starts on.
export function EarlierBalanceSheet({ visible, onClose, onSaved, account, amount, remaining, onPay }: Props) {
  const styles = useStyles();
  const [monthsText, setMonthsText] = useState('1');
  const [firstBill, setFirstBill] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = account.billDay != null ? firstBillOptions(account.billDay, nowIso(), 4) : [];
  // Keep an already-chosen bill selectable even once it's in the past.
  const choices = firstBill && !options.includes(firstBill) ? [firstBill, ...options] : options;

  useEffect(() => {
    if (!visible) return;
    setMonthsText(String(account.earlierBalanceMonths ?? 1));
    setFirstBill(account.earlierBalanceFirstBill ?? options[0] ?? null);
    setError(null);
  }, [visible]);

  const months = parseInt(monthsText, 10);
  const valid = months >= 1 && months <= 60;

  async function handleSave() {
    if (!valid) { setError('Enter 1 to 60 months'); return; }
    setSaving(true);
    try {
      await accountRepo.update(account.id, { earlierBalanceMonths: months, earlierBalanceFirstBill: firstBill });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Earlier Balance">
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AppText variant="bodySm" color="textMuted">
          {formatPHP(amount)} was owed on {account.name} beyond the purchases recorded here
          {remaining > 0 ? `; ${formatPHP(remaining)} of it is still unpaid.` : ", and it's paid off."}
        </AppText>
        {remaining > 0 ? <Button label={`Pay ${formatPHP(remaining)}`} onPress={onPay} /> : null}
        <AppText variant="labelLg" color="textSecondary">Split it the way {account.name} bills you</AppText>
        <AppTextInput label="Months left" value={monthsText} onChangeText={setMonthsText} numeric error={error ?? undefined} />
        <View style={styles.block}>
          <AppText variant="labelLg" color="textSecondary">First bill</AppText>
          <View style={styles.chipRow}>
            {choices.map((d) => (
              <Chip key={d} label={displayDate(d)} selected={firstBill === d} onPress={() => setFirstBill(d)} />
            ))}
          </View>
        </View>
        {valid ? (
          <AppText variant="bodySm" color="textSecondary">
            {formatPHP(Math.round((amount / months) * 100) / 100)}/month on {months} {months === 1 ? 'bill' : 'bills'}
            {firstBill ? ` from ${displayDate(firstBill)}` : ''}
          </AppText>
        ) : null}
        <Button label="Save split" variant="secondary" onPress={handleSave} loading={saving} />
        <View style={styles.bottomPad} />
      </ScrollView>
    </BottomSheet>
  );
}

const useStyles = makeStyles(() => ({
  form: { gap: theme.spacing[5] },
  block: { gap: theme.spacing[3] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] },
  bottomPad: { height: theme.spacing[5] },
}));
