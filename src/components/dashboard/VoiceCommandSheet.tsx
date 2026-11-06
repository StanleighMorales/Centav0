import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AppText } from '../ui/AppText';
import { VoiceInputButton } from './VoiceInputButton';
import { parseVoiceCommand, type VoiceCommand } from '../../utils/voiceTransaction';
import { accountRepo, debtRepo } from '../../repositories';
import { theme, makeStyles, useTheme } from '../../theme';
import type { Account, Debt } from '../../domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCommand: (cmd: Exclude<VoiceCommand, { kind: 'transaction' }>) => void;
};

// Transfers and debt payments only. Spending goes through Add Transaction.
export function VoiceCommandSheet({ visible, onClose, onCommand }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [data, setData] = useState<{ accounts: Account[]; debts: Debt[] } | null>(null);
  const [notCommand, setNotCommand] = useState(false);

  useEffect(() => {
    if (!visible) { setNotCommand(false); setData(null); return; }
    Promise.all([accountRepo.list(), debtRepo.list()]).then(([accounts, debts]) => setData({ accounts, debts }));
  }, [visible]);

  function handleResult(text: string) {
    if (!data) return;
    const cmd = parseVoiceCommand(text, data.accounts, data.debts);
    if (cmd.kind === 'transaction') { setNotCommand(true); return; }
    onClose();
    onCommand(cmd);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Voice command">
      <View style={styles.body}>
        {/* Mount once names are loaded, so auto-start listens for them. */}
        {data ? (
          <VoiceInputButton
            onResult={handleResult}
            autoStart
            label="Speak a payment or transfer"
            hint="Try “pay my atome balance with gcash” or “transfer all cash to gcash”"
            names={[...data.accounts.map((a) => a.name), ...data.debts.map((d) => d.creditor)]}
          />
        ) : (
          <ActivityIndicator color={colors.accentPrimary} />
        )}
        {notCommand ? (
          <AppText variant="bodySm" color="negative">
            That sounds like an expense. Say a payment or transfer, or tap + to add an expense.
          </AppText>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles(() => ({
  body: { gap: theme.spacing[4], paddingBottom: theme.spacing[5] },
}));
