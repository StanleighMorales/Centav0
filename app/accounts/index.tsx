import React, { useState, useCallback, useRef } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { Card } from '../../src/components/ui/Card';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FAB } from '../../src/components/ui/FAB';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { AddAccountSheet } from '../../src/components/accounts/AddAccountSheet';
import { AddMoneySheet } from '../../src/components/accounts/AddMoneySheet';
import { TransferSheet } from '../../src/components/transactions/TransferSheet';
import { accountRepo, debtRepo, transactionRepo } from '../../src/repositories';
import { formatPHP } from '../../src/utils/currency';
import { accountIcon, groupAccounts } from '../../src/utils/accounts';
import { theme, makeStyles, useTheme } from '../../src/theme';
import type { Account } from '../../src/domain/types';

type RowProps = {
  account: Account;
  onEdit: (a: Account) => void;
  onAddMoney: (a: Account) => void;
  onDelete: (a: Account) => void;
};

function AccountRow({ account, onEdit, onAddMoney, onDelete }: RowProps) {
  const styles = useStyles();
  const { colors } = useTheme();
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
            <Feather name="edit-2" size={18} color={colors.textPrimary} />
            <AppText variant="labelSm" color="textPrimary">Edit</AppText>
          </Pressable>
          <Pressable
            onPress={() => { close(); onDelete(account); }}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${account.name}`}
            style={[styles.action, styles.deleteAction]}
          >
            <Feather name="trash-2" size={18} color={colors.textPrimary} />
            <AppText variant="labelSm" color="textPrimary">Delete</AppText>
          </Pressable>
        </View>
      )}
    >
      <Card accent style={styles.accountCard}>
        <View style={styles.cardRow}>
          <View style={styles.iconCircle}>
            <Feather name={accountIcon(account)} size={18} color={colors.accentPrimary} />
          </View>
          <View style={styles.cardInfo}>
            <AppText variant="h3">{account.name}</AppText>
            <AppText variant="labelLg" color="textSecondary">
              {account.typeName}
            </AppText>
            {account.allowsOverdraft && (account.billDay != null || account.dueDay != null) ? (
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
            <Feather name="plus" size={20} color={colors.accentPrimary} />
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
  const styles = useStyles();
  const { colors } = useTheme();
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
  const [deleteHasHistory, setDeleteHasHistory] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setAccounts(await accountRepo.list());
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleDeletePress(account: Account) {
    const debts = await debtRepo.list();
    const linkedDebt = debts.find((d) => d.linkedAccountId === account.id);
    const owed = linkedDebt ? linkedDebt.outstandingBalance : account.currentBalance;
    const txns = await transactionRepo.list({ accountId: account.id });
    setDeleteBlocked(owed !== 0);
    setDeleteHasHistory(txns.length > 0 || linkedDebt !== undefined);
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
    setDeleteHasHistory(false);
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
          <Feather name="chevron-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <AppText variant="h2" style={styles.flex}>Accounts</AppText>
        <Pressable
          onPress={() => setTransferSheetVisible(true)}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Transfer between accounts"
        >
          <Feather name="repeat" size={20} color={colors.accentPrimary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accentPrimary} size="large" />
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
            groupAccounts(accounts).map((group) => (
              <View key={group.label} style={styles.group}>
                <SectionHeader title={group.label} />
                {group.accounts.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    onEdit={setEditAccount}
                    onAddMoney={setAddMoneyAccount}
                    onDelete={handleDeletePress}
                  />
                ))}
              </View>
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
            ? `"${pendingDelete?.name}" still has an outstanding balance. Pay it off before deleting.`
            : deleteHasHistory
              ? `"${pendingDelete?.name}" has debts or transactions linked to it. Deleting it won't delete them — they'll stay visible, marked as a deleted account. You can manually delete individual transactions later from Settings > Transaction Archive.`
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

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bgPrimary },
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
  group: { gap: theme.spacing[4] },
  accountCard: { gap: theme.spacing[4] },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4] },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: c.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, gap: theme.spacing[1] },
  addMoneyBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: c.accentSubtle,
    borderWidth: 1,
    borderColor: c.accentBorder,
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
  editAction: { backgroundColor: c.bgElevated },
  deleteAction: { backgroundColor: c.negative },
}));
