import React, { createContext, useContext, useEffect, useState } from 'react';
import { View } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AppText } from '../ui/AppText';
import { VoiceInputButton } from './VoiceInputButton';
import { parseVoiceCommand, type VoiceCommand } from '../../utils/voiceTransaction';
import { accountRepo, debtRepo } from '../../repositories';
import { theme, makeStyles } from '../../theme';
import type { Account, Debt } from '../../domain/types';

/** Opens the tab layout's voice command sheet from any tab screen (Ledger's mic). */
export const OpenVoiceCommandContext = createContext<() => void>(() => {});
export const useOpenVoiceCommand = () => useContext(OpenVoiceCommandContext);

type Props = {
  visible: boolean;
  onClose: () => void;
  onCommand: (cmd: Exclude<VoiceCommand, { kind: 'transaction' }>) => void;
};

// Transfers and debt payments only. Spending goes through Add Transaction.
export function VoiceCommandSheet({ visible, onClose, onCommand }: Props) {
  const styles = useStyles();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [notCommand, setNotCommand] = useState(false);

  useEffect(() => {
    if (!visible) { setNotCommand(false); return; }
    accountRepo.list().then(setAccounts);
    debtRepo.list().then(setDebts);
  }, [visible]);

  function handleResult(text: string) {
    const cmd = parseVoiceCommand(text, accounts, debts);
    if (cmd.kind === 'transaction') { setNotCommand(true); return; }
    onClose();
    onCommand(cmd);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Voice command">
      <View style={styles.body}>
        <VoiceInputButton
          onResult={handleResult}
          autoStart
          label="Speak a payment or transfer"
          hint="Try “pay my atome balance with gcash” or “transfer all cash to gcash”"
        />
        {notCommand ? (
          <AppText variant="bodySm" color="negative">
            That sounds like an expense. Say a payment or transfer, or add it with + instead.
          </AppText>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles(() => ({
  body: { gap: theme.spacing[4], paddingBottom: theme.spacing[5] },
}));
