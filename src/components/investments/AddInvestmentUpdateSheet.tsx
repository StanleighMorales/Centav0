import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { SheetScrollView as ScrollView, BottomSheet } from '../ui/BottomSheet';
import { AppTextInput } from '../ui/AppTextInput';
import { AmountInput } from '../ui/AmountInput';
import { DatePicker } from '../ui/DatePicker';
import { Segmented } from '../ui/Segmented';
import { Button } from '../ui/Button';
import { AppText } from '../ui/AppText';
import { investmentRepo } from '../../repositories';
import { amountFromRoi, roiOf, formatPct } from '../../utils/investments';
import { formatPHP } from '../../utils/currency';
import { theme, makeStyles } from '../../theme';
import { nowIso } from '../../utils/date';

type Mode = 'Cash received' | 'Percent ROI';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  investmentId: string;
  investmentName: string;
  amountPaid: number;
  returned: number;
};

export function AddInvestmentUpdateSheet({ visible, onClose, onSuccess, investmentId, investmentName, amountPaid, returned }: Props) {
  const styles = useStyles();
  const canUsePercent = amountPaid > 0;
  const [mode, setMode] = useState<Mode>('Cash received');
  const [cash, setCash] = useState(0);
  const [pct, setPct] = useState('');
  const [stake, setStake] = useState('');
  const [date, setDate] = useState(nowIso());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;
    setMode('Cash received');
    setCash(0);
    setPct('');
    setStake('');
    setDate(nowIso());
    setNote('');
    setErrors({});
  }, [visible]);

  const pctNum = Number(pct) || 0;
  const amount = mode === 'Cash received' ? cash : amountFromRoi(amountPaid, pctNum);
  const stakeNum = stake.trim() === '' ? null : Number(stake);

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (stakeNum != null && (Number.isNaN(stakeNum) || stakeNum < 0 || stakeNum > 100)) errs.stake = 'Enter 0 to 100';
    if (amount <= 0 && stakeNum == null) errs.amount = 'Enter what you received, or a new stake %';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      await investmentRepo.addUpdate(investmentId, { date, amount, stakePct: stakeNum, note: note.trim() || undefined });
      onSuccess();
      onClose();
    } catch (e) {
      setErrors({ amount: e instanceof Error ? e.message : 'Could not save update' });
    } finally {
      setSaving(false);
    }
  }

  const roi = roiOf(amountPaid, amount);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Update">
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AppText variant="bodySm" color="textMuted">{investmentName}</AppText>
        {canUsePercent && <Segmented options={['Cash received', 'Percent ROI'] as const} value={mode} onChange={(m) => { setMode(m); setErrors({}); }} />}
        {mode === 'Cash received' ? (
          <AmountInput label="Amount Received" value={cash} onChange={setCash} error={errors.amount} />
        ) : (
          <AppTextInput label="ROI received (%)" value={pct} onChangeText={setPct} placeholder="e.g. 25" numeric error={errors.amount} />
        )}
        {amount > 0 ? (
          <View style={styles.preview}>
            <AppText variant="bodySm" color="textMuted">
              {mode === 'Percent ROI' ? `${formatPHP(amount)} on the ${formatPHP(amountPaid)} you paid` : roi != null ? `${formatPct(roi)} of the ${formatPHP(amountPaid)} you paid` : 'No amount paid, so only the peso amount is tracked'}
            </AppText>
            <AppText variant="bodySm" color="positive">Total returned becomes {formatPHP(returned + amount)}</AppText>
          </View>
        ) : null}
        <DatePicker label="Date" value={date} onChange={setDate} />
        <AppTextInput label="Stake is now % (optional)" value={stake} onChangeText={setStake} placeholder="Only if it changed" numeric error={errors.stake} />
        <AppTextInput label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Q4 payout" />
        <Button label="Save Update" onPress={handleSave} loading={saving} />
      </ScrollView>
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
  form: { gap: theme.spacing[5] },
  preview: {
    backgroundColor: c.bgSurface,
    borderRadius: theme.radius.md,
    padding: theme.spacing[4],
    gap: theme.spacing[2],
  },
}));
