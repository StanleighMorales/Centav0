import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { accountRepo } from '../../src/repositories';
import type { AccountType } from '../../src/domain/types';
import { theme } from '../../src/theme';

const ACCOUNT_TYPES: AccountType[] = ['Cash', 'Bank', 'EWallet', 'Other'];

export default function SetupAccountScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('Cash');
  const [balance, setBalance] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Account name is required.'); return; }
    const initialBalance = parseFloat(balance) || 0;
    setSaving(true);
    setError(null);
    try {
      await accountRepo.create({ name: trimmed, type, initialBalance });
      router.replace('/(tabs)');
    } catch (e) {
      setError('Failed to create account. Please try again.');
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>Set up your{'\n'}first account</Text>
          <Text style={styles.sub}>
            This is where your starting balance lives. You can add more accounts later.
          </Text>

          <Text style={styles.label}>Account Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. GCash, BPI Savings, Wallet"
            placeholderTextColor={theme.colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="next"
            accessibilityLabel="Account name"
          />

          <Text style={styles.label}>Account Type</Text>
          <View style={styles.typeRow}>
            {ACCOUNT_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, type === t && styles.chipActive]}
                onPress={() => setType(t)}
                accessibilityRole="radio"
                accessibilityState={{ checked: type === t }}
                accessibilityLabel={t}
              >
                <Text style={[styles.chipText, type === t && styles.chipTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Starting Balance</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.peso}>₱</Text>
            <TextInput
              style={styles.balanceInput}
              placeholder="0.00"
              placeholderTextColor={theme.colors.textMuted}
              value={balance}
              onChangeText={setBalance}
              keyboardType="decimal-pad"
              returnKeyType="done"
              accessibilityLabel="Starting balance"
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.btn, saving && styles.btnDisabled]}
            onPress={handleCreate}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Create Account"
          >
            {saving
              ? <ActivityIndicator color={theme.colors.bgPrimary} />
              : <Text style={styles.btnText}>Create Account</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  flex: { flex: 1 },
  scroll: { padding: theme.spacing['6'], paddingTop: theme.spacing['10'] },

  heading: {
    ...theme.typography.displaySm,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing['3'],
  },
  sub: {
    ...theme.typography.bodySm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing['9'],
  },

  label: {
    ...theme.typography.label,
    color: theme.colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: theme.spacing['3'],
    marginTop: theme.spacing['7'],
  },

  input: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.bgInput,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing['5'],
    paddingVertical: theme.spacing['4'],
  },

  typeRow: {
    flexDirection: 'row',
    gap: theme.spacing['3'],
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: theme.spacing['5'],
    paddingVertical: theme.spacing['3'],
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.bgSurface,
  },
  chipActive: {
    borderColor: theme.colors.accentPrimary,
    backgroundColor: theme.colors.accentSubtle,
  },
  chipText: {
    ...theme.typography.labelLg,
    color: theme.colors.textSecondary,
  },
  chipTextActive: {
    color: theme.colors.accentPrimary,
  },

  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgInput,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing['5'],
  },
  peso: {
    ...theme.typography.amountMd,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing['2'],
  },
  balanceInput: {
    ...theme.typography.amountMd,
    color: theme.colors.textPrimary,
    flex: 1,
    paddingVertical: theme.spacing['4'],
  },

  error: {
    ...theme.typography.bodySm,
    color: theme.colors.negative,
    marginTop: theme.spacing['5'],
  },

  btn: {
    backgroundColor: theme.colors.accentPrimary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing['5'],
    alignItems: 'center',
    marginTop: theme.spacing['9'],
  },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    ...theme.typography.labelLg,
    color: theme.colors.bgPrimary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
