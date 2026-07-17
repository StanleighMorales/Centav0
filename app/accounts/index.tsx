import React, { useState, useCallback, useRef } from 'react';
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { Card } from '../../src/components/ui/Card';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FAB } from '../../src/components/ui/FAB';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { AddAccountSheet } from '../../src/components/accounts/AddAccountSheet';
import { AddMoneySheet } from '../../src/components/accounts/AddMoneySheet';
import { TransferSheet } from '../../src/components/transactions/TransferSheet';
import { accountRepo, transactionRepo } from '../../src/repositories';
import { formatPHP } from '../../src/utils/currency';
import { theme } from '../../src/theme';
import type { Account, AccountType } from '../../src/domain/types';

const ACCOUNT_ICON: Record<AccountType, React.ComponentProps<typeof Feather>['name']> = {
  Cash: 'dollar-sign',
  Bank: 'home',
  EWallet: 'smartphone',
  CreditCard: 'credit-card',
  Other: 'briefcase',
};

type RowProps = {
  account: Account;
  onEdit: (a: Account) => void;
  onAddMoney: (a: Account) => void;
  onDelete: (a: Account) => void;
};

function AccountRow({ account, onEdit, onAddMoney, onDelete }: RowProps) {
  const swipeRef = useRef<Swipeable>(null);
  const close = () => swipeRef.current?.close();

  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      renderRightActions={() => (
        <View style={styles.actions}>
          <Pressable
            onPress={() => { close(); onEdit(account); }}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${account.name}`}
            style={[styles.action, styles.editAction]}
          >
            <Feather name="edit-2" size={18} color={theme.colors.textPrimary} />
            <AppText variant="labelSm" color="textPrimary">Edit</AppText>
          </Pressable>
          <Pressable
            onPress={() => { close(); onDelete(account); }}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${account.name}`}
            style={[styles.action, styles.deleteAction]}
          >
            <Feather name="trash-2" size={18} color={theme.colors.textPrimary} />
            <AppText variant="labelSm" color="textPrimary">Delete</AppText>
          </Pressable>
        </View>
      )}
    >
      <Card accent style={styles.accountCard}>
        <View style={styles.cardRow}>
          <View style={styles.iconCircle}>
            <Feather name={ACCOUNT_ICON[account.type]} size={18} color={theme.colors.accentPrimary} />
          </View>
          <View style={styles.cardInfo}>
            <AppText variant="h3">{account.name}</AppText>
            <AppText variant="labelLg" color="textSecondary">
              {account.type === 'CreditCard' ? 'Credit Card' : account.type}
            </AppText>
            {account.type === 'CreditCard' && (account.billDay != null || account.dueDay != null) ? (
              <AppText variant="bodySm" color="textMuted">
                {[
                  account.billDay != null ? `Bill day ${account.billDay}` : null,
                  account.dueDay != null ? `Due day ${account.dueDay}` : null,
                ].filter(Boolean).join(' · ')}
              </AppText>
            ) : null}
          </View>
          <Pressable
            onPress={() => onAddMoney(account)}
            accessibilityRole="button"
            accessibilityLabel={`Add money to ${account.name}`}
            hitSlop={8}
            style={styles.addMoneyBtn}
          >
            <Feather name="plus" size={20} color={theme.colors.accentPrimary} />
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
    </Swipeable>
  );
}

export default function AccountsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [transferSheetVisible, setTransferSheetVisible] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [addMoneyAccount, setAddMoneyAccount] = useState<Account | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setAccounts(await accountRepo.list());
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
        <AppText variant="h2" style={styles.flex}>Accounts</AppText>
        <Pressable
          onPress={() => setTransferSheetVisible(true)}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Transfer between accounts"
        >
          <Feather name="repeat" size={20} color={theme.colors.accentPrimary} />
        </Pressable>
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
              <AccountRow
                key={account.id}
                account={account}
                onEdit={setEditAccount}
                onAddMoney={setAddMoneyAccount}
                onDelete={handleDeletePress}
              />
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

      <AddAccountSheet
        visible={editAccount !== null}
        initial={editAccount ?? undefined}
        onClose={() => setEditAccount(null)}
        onSuccess={load}
      />

      <AddMoneySheet
        visible={addMoneyAccount !== null}
        account={addMoneyAccount}
        onClose={() => setAddMoneyAccount(null)}
        onSuccess={load}
      />

      <TransferSheet
        visible={transferSheetVisible}
        onClose={() => setTransferSheetVisible(false)}
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
  flex: { flex: 1 },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -theme.spacing[2],
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
  addMoneyBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentSubtle,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balance: { marginTop: theme.spacing[2] },
  actions: { flexDirection: 'row', alignItems: 'stretch' },
  action: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
  },
  editAction: { backgroundColor: theme.colors.bgElevated },
  deleteAction: { backgroundColor: theme.colors.negative },
});
