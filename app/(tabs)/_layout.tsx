import React, { useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { FloatingTabBar } from '../../src/components/nav/FloatingTabBar';
import { AddTransactionSheet } from '../../src/components/dashboard/AddTransactionSheet';
import { TransferSheet } from '../../src/components/transactions/TransferSheet';
import { DebtPickerSheet } from '../../src/components/debts/DebtPickerSheet';
import { VoiceCommandSheet, OpenVoiceCommandContext } from '../../src/components/dashboard/VoiceCommandSheet';
import { emitDataChanged } from '../../src/utils/dataEvents';
import type { VoiceCommand } from '../../src/utils/voiceTransaction';
import { useTheme } from '../../src/theme';

type TransferCmd = Extract<VoiceCommand, { kind: 'transfer' }>;
type PayCmd = Extract<VoiceCommand, { kind: 'pay' }>;

export default function TabLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [autoStart, setAutoStart] = useState<'voice' | 'camera' | null>(null);
  const openAdd = (mode: 'voice' | 'camera' | null = null) => { setAutoStart(mode); setAddOpen(true); };
  const [transfer, setTransfer] = useState<TransferCmd | null>(null);
  // A spoken payment that didn't name the debt waits here while the user picks one.
  const [unpicked, setUnpicked] = useState<PayCmd | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);

  // The debt screen opens its payment sheet from these params, so card charges load in one place.
  function pay(debtId: string, cmd: PayCmd) {
    const params: Record<string, string> = { id: debtId, pay: '1' };
    if (cmd.accountId) params.accountId = cmd.accountId;
    if (cmd.amount) params.amount = String(cmd.amount);
    router.push({ pathname: '/debts/[id]', params });
  }

  function onVoiceCommand(cmd: TransferCmd | PayCmd) {
    if (cmd.kind === 'transfer') setTransfer(cmd);
    else if (cmd.debtId) pay(cmd.debtId, cmd);
    else setUnpicked(cmd);
  }

  return (
    <OpenVoiceCommandContext.Provider value={() => setVoiceOpen(true)}>
      <Tabs
        tabBar={(props) => (
          <FloatingTabBar
            state={props.state}
            navigation={props.navigation}
            // On Ledger, the dial's Voice speaks a payment or transfer instead of an expense.
            onAdd={(mode) =>
              mode === 'voice' && props.state.routes[props.state.index]?.name === 'ledger'
                ? setVoiceOpen(true)
                : openAdd(mode)}
          />
        )}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          sceneStyle: { backgroundColor: colors.bgPrimary },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="transactions" options={{ title: 'Activity' }} />
        <Tabs.Screen name="ledger" options={{ title: 'Ledger' }} />
        <Tabs.Screen name="more" options={{ title: 'More' }} />
      </Tabs>

      <AddTransactionSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={emitDataChanged}
        autoStart={autoStart}
        onVoiceCommand={onVoiceCommand}
      />
      <TransferSheet
        visible={transfer !== null}
        onClose={() => setTransfer(null)}
        onSuccess={emitDataChanged}
        prefill={transfer}
      />
      <DebtPickerSheet
        visible={unpicked !== null}
        onClose={() => setUnpicked(null)}
        onPick={(debt) => { if (unpicked) pay(debt.id, unpicked); setUnpicked(null); }}
      />
      <VoiceCommandSheet visible={voiceOpen} onClose={() => setVoiceOpen(false)} onCommand={onVoiceCommand} />
    </OpenVoiceCommandContext.Provider>
  );
}
