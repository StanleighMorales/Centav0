import React, { useState, useCallback } from 'react';
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { Card } from '../../src/components/ui/Card';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FAB } from '../../src/components/ui/FAB';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { AddAccountSheet } from '../../src/components/accounts/AddAccountSheet';
import { accountRepo, transactionRepo } from '../../src/repositories';
import { formatPHP } from '../../src/utils/currency';
import { theme } from '../../src/theme';
import type { Account, AccountType } from '../../src/domain/types';

const ACCOUNT_ICON: Record<AccountType, React.ComponentProps<typeof Feather>['name']> = {
  Cash: 'dollar-sign',
  Bank: 'credit-card',
  EWallet: 'smartphone',
  Other: 'briefcase',
};

export default function AccountsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setAccounts(await accountRepo.list());
    setLoading(false);
  }, []);

  useFocusEffect(load);

  async function handleDeletePress(account: Account) {
    const txns = await transactionRepo.list({ accountId: account.id });
    setDeleteBlocked(txns.length > 0);
    setPendingDelete(account);
  }

  async function handleDeleteConfirm() {
    if (!pendingDelete || deleteBlocked) return;
    setDeleting(true);
    try {
      await accountRepo.softDelete(pendingDelete.id);
      setPendingDelete(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  function handleDialogDismiss() {
    setPendingDelete(null);
    setDeleteBlocked(false);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={22} color={theme.colors.textPrimary} />
        </Pressable>
        <AppText variant="h2">Accounts</AppText>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={theme.colors.accentPrimary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 80 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {accounts.length === 0 ? (
            <EmptyState
              icon="credit-card"
              title="No accounts"
              subtitle="Tap + to add your first account"
            />
          ) : (
            accounts.map((account) => (
              <Card key={account.id} accent style={styles.accountCard}>
                <View style={styles.cardRow}>
                  <View style={styles.iconCircle}>
                    <Feather
                      name={ACCOUNT_ICON[account.type]}
                      size={18}
                      color={theme.colors.accentPrimary}
                    />
                  </View>
                  <View style={styles.cardInfo}>
                    <AppText variant="h3">{account.name}</AppText>
                    <AppText variant="labelLg" color="textSecondary">{account.type}</AppText>
                  </View>
                  <Pressable
                    onPress={() => handleDeletePress(account)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${account.name}`}
                    hitSlop={8}
                    style={styles.deleteBtn}
                  >
                    <Feather name="trash-2" size={18} color={theme.colors.textMuted} />
                  </Pressable>
                </View>
                <AppText
                  variant="amountLg"
                  color={account.currentBalance >= 0 ? 'textPrimary' : 'negative'}
                  style={styles.balance}
                >
                  {formatPHP(account.currentBalance)}
                </AppText>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      <FAB onPress={() => setSheetVisible(true)} accessibilityLabel="Add account" />

      <AddAccountSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSuccess={load}
      />

      <ConfirmDialog
        visible={pendingDelete !== null}
        title={deleteBlocked ? 'Cannot Delete' : 'Delete Account'}
        message={
          deleteBlocked
            ? `"${pendingDelete?.name}" has transactions and cannot be deleted.`
            : `Delete "${pendingDelete?.name}"? This cannot be undone.`
        }
        confirmLabel={deleteBlocked ? 'OK' : deleting ? 'Deleting…' : 'Delete'}
        onConfirm={deleteBlocked ? handleDialogDismiss : handleDeleteConfirm}
        onCancel={handleDialogDismiss}
        destructive={!deleteBlocked}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[5],
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -theme.spacing[3],
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: {
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[4],
  },
  accountCard: { gap: theme.spacing[4] },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, gap: theme.spacing[1] },
  deleteBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balance: { marginTop: theme.spacing[2] },
});
