import React, { useState, useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SheetScrollView as ScrollView, BottomSheet } from '../ui/BottomSheet';
import { AppTextInput } from '../ui/AppTextInput';
import { AmountInput } from '../ui/AmountInput';
import { DatePicker } from '../ui/DatePicker';
import { Segmented } from '../ui/Segmented';
import { Button } from '../ui/Button';
import { AppText } from '../ui/AppText';
import { investmentRepo } from '../../repositories';
import { pickContractPdf, formatFileSize, type PickedContract } from '../../utils/contracts';
import { theme, makeStyles, useTheme } from '../../theme';
import { nowIso } from '../../utils/date';
import type { Investment } from '../../domain/types';

type Kind = 'I paid' | 'Free stake';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initial?: Investment;
};

const optionalNumber = (s: string) => (s.trim() === '' ? null : Number(s));

export function AddInvestmentSheet({ visible, onClose, onSuccess, initial }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isEdit = !!initial;
  const [kind, setKind] = useState<Kind>('I paid');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [stake, setStake] = useState('');
  const [target, setTarget] = useState('');
  const [date, setDate] = useState(nowIso());
  const [note, setNote] = useState('');
  const [contract, setContract] = useState<PickedContract | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;
    setKind('I paid');
    setName(initial?.name ?? '');
    setAmount(0);
    setStake(initial?.stakePct != null ? String(initial.stakePct) : '');
    setTarget(initial?.expectedReturnPct != null ? String(initial.expectedReturnPct) : '');
    setDate(initial?.startDate ?? nowIso());
    setNote(initial?.note ?? '');
    setContract(null);
    setErrors({});
  }, [visible]);

  async function handlePick() {
    try {
      const picked = await pickContractPdf();
      if (picked) setContract(picked);
    } catch (e) {
      setErrors((p) => ({ ...p, contract: e instanceof Error ? e.message : 'Could not attach that file' }));
    }
  }

  async function handleSave() {
    const errs: Record<string, string> = {};
    const stakePct = optionalNumber(stake);
    const expectedReturnPct = optionalNumber(target);
    if (!name.trim()) errs.name = 'Enter a name';
    if (!isEdit && kind === 'I paid' && amount <= 0) errs.amount = 'Enter the amount you paid';
    if (stakePct != null && (Number.isNaN(stakePct) || stakePct < 0 || stakePct > 100)) errs.stake = 'Enter 0 to 100';
    if (expectedReturnPct != null && (Number.isNaN(expectedReturnPct) || expectedReturnPct < 0)) errs.target = 'Enter a number';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      if (initial) {
        await investmentRepo.update(initial.id, { name: name.trim(), stakePct, expectedReturnPct, note: note.trim() || null });
      } else {
        const created = await investmentRepo.create({
          name: name.trim(), amountPaid: kind === 'I paid' ? amount : 0, stakePct, expectedReturnPct,
          startDate: date, note: note.trim() || undefined,
        });
        if (contract) await investmentRepo.addDocument(created.id, contract);
      }
      onSuccess();
      onClose();
    } catch (e) {
      setErrors({ name: e instanceof Error ? e.message : 'Could not save investment' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={isEdit ? 'Edit Investment' : 'Add Investment'}>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!isEdit && <Segmented options={['I paid', 'Free stake'] as const} value={kind} onChange={setKind} />}
        <AppTextInput label="Company or asset" value={name} onChangeText={setName} placeholder="e.g. Northwind Coffee Co." error={errors.name} />
        {!isEdit && kind === 'I paid' && (
          <AmountInput label="Amount Paid" value={amount} onChange={setAmount} error={errors.amount} />
        )}
        <AppTextInput label="Stake % (optional)" value={stake} onChangeText={setStake} placeholder="e.g. 5" numeric error={errors.stake} />
        <AppTextInput
          label="Expected return % (optional)" value={target} onChangeText={setTarget} placeholder="Leave empty if no target"
          numeric error={errors.target}
        />
        {!isEdit && <DatePicker label="Date" value={date} onChange={setDate} />}
        <AppTextInput label="Note (optional)" value={note} onChangeText={setNote} placeholder="Additional details" />
        {!isEdit && (
          <View style={styles.contractBlock}>
            <AppText variant="labelLg" color="textSecondary">Contract (optional)</AppText>
            <Pressable
              onPress={handlePick}
              accessibilityRole="button"
              accessibilityLabel={contract ? `Contract ${contract.name}, tap to change` : 'Attach contract PDF'}
              style={({ pressed }) => [styles.pick, pressed && styles.pressed]}
            >
              <Feather name={contract ? 'file-text' : 'paperclip'} size={20} color={colors.accentText} />
              <View style={styles.pickText}>
                <AppText variant="h4" numberOfLines={1}>{contract ? contract.name : 'Attach a PDF'}</AppText>
                <AppText variant="bodySm" color="textMuted">{contract ? formatFileSize(contract.size) : 'Saved inside the app'}</AppText>
              </View>
            </Pressable>
            {errors.contract ? <AppText variant="bodySm" color="negative">{errors.contract}</AppText> : null}
          </View>
        )}
        <Button label={isEdit ? 'Save Changes' : 'Save Investment'} onPress={handleSave} loading={saving} />
      </ScrollView>
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
  form: { gap: theme.spacing[5] },
  contractBlock: { gap: theme.spacing[3] },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[4],
    padding: theme.spacing[4],
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.accentBorder,
    backgroundColor: c.accentSubtle,
    minHeight: 56,
  },
  pickText: { flex: 1 },
  pressed: { opacity: 0.7 },
}));
