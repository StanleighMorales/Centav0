import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { AppTextInput } from '../../src/components/ui/AppTextInput';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { Button } from '../../src/components/ui/Button';
import { LoadingOverlay } from '../../src/components/ui/LoadingOverlay';
import { exportBackup, restoreBackup, InvalidBackupError } from '../../src/db/backup';
import { resetAppData } from '../../src/db/database';
import { theme } from '../../src/theme';

type RowProps = {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

function Row({ icon, label, onPress, destructive }: RowProps) {
  const color = destructive ? theme.colors.negative : theme.colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Feather name={icon} size={20} color={color} />
      <AppText variant="body" color={destructive ? 'negative' : 'textPrimary'} style={styles.rowLabel}>
        {label}
      </AppText>
      <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [resetVisible, setResetVisible] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleBackup() {
    setError(null);
    setBusy('Preparing backup…');
    try {
      await exportBackup();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleRestore() {
    setError(null);
    setBusy('Restoring…');
    try {
      const result = await restoreBackup();
      if (result === 'restored') router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof InvalidBackupError ? e.message : `Restore failed: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  function closeReset() {
    setResetVisible(false);
    setConfirmText('');
  }

  async function handleReset() {
    if (confirmText !== 'CONFIRM') return;
    setBusy('Removing all data…');
    try {
      await resetAppData();
      closeReset();
      router.replace('/onboarding');
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + theme.spacing[5] }]}>
      <AppText variant="h2" style={styles.title}>Settings</AppText>

      <AppText variant="labelSm" color="textMuted" style={styles.sectionLabel}>DATA</AppText>
      <Row icon="upload" label="Back up now" onPress={handleBackup} />
      <Row icon="download" label="Restore from file" onPress={handleRestore} />
      <Row icon="trash-2" label="Remove all data" onPress={() => setResetVisible(true)} destructive />

      {error ? (
        <AppText variant="bodySm" color="negative" style={styles.error}>{error}</AppText>
      ) : null}

      <AppText variant="labelSm" color="textMuted" style={[styles.sectionLabel, styles.sectionGap]}>ABOUT</AppText>
      <View style={styles.aboutRow}>
        <AppText variant="body" color="textSecondary">Version</AppText>
        <AppText variant="body" color="textPrimary">{Constants.expoConfig?.version ?? '—'}</AppText>
      </View>

      <BottomSheet visible={resetVisible} onClose={closeReset} title="Remove All Data">
        <View style={styles.resetSheet}>
          <AppText variant="body" color="textSecondary">
            This deletes every account, category, transaction, budget, debt, payment, and lending
            record. Back up first if you want to keep it. Type CONFIRM to continue.
          </AppText>
          <AppTextInput
            label="Confirmation"
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="CONFIRM"
            autoFocus
          />
          <View style={styles.actions}>
            <Button label="Cancel" onPress={closeReset} variant="ghost" style={styles.action} />
            <Button
              label="Remove"
              onPress={handleReset}
              disabled={confirmText !== 'CONFIRM'}
              variant="secondary"
              style={{ ...styles.action, ...styles.dangerButton }}
              accessibilityLabel="Remove all data"
            />
          </View>
        </View>
      </BottomSheet>

      <LoadingOverlay visible={busy !== null} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgPrimary, paddingHorizontal: theme.spacing[5] },
  title: { marginBottom: theme.spacing[6] },
  sectionLabel: { letterSpacing: 0.8, marginBottom: theme.spacing[2] },
  sectionGap: { marginTop: theme.spacing[6] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[4],
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  rowPressed: { opacity: 0.6 },
  rowLabel: { flex: 1 },
  error: { marginTop: theme.spacing[3] },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  resetSheet: { gap: theme.spacing[5] },
  actions: { flexDirection: 'row', gap: theme.spacing[4] },
  action: { flex: 1 },
  dangerButton: { borderColor: theme.colors.negative },
});
