import React, { useState, useCallback } from 'react';
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FAB } from '../../src/components/ui/FAB';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { AccountTypeSheet } from '../../src/components/accounts/AccountTypeSheet';
import { accountTypeRepo, accountRepo } from '../../src/repositories';
import { theme } from '../../src/theme';
import type { AccountType } from '../../src/domain/types';

export default function AccountTypesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [types, setTypes] = useState<AccountType[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<AccountType | undefined>();
  const [pendingDelete, setPendingDelete] = useState<AccountType | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await accountTypeRepo.list();
    setTypes(list);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function handleAddPress() {
    setEditTarget(undefined);
    setSheetVisible(true);
  }

  function handleEditPress(t: AccountType) {
    setEditTarget(t);
    setSheetVisible(true);
  }

  async function handleDeletePress(t: AccountType) {
    const accounts = await accountRepo.list();
    setDeleteBlocked(accounts.some((a) => a.accountTypeId === t.id));
    setPendingDelete(t);
  }

  async function handleDeleteConfirm() {
    if (!pendingDelete || deleteBlocked) return;
    await accountTypeRepo.softDelete(pendingDelete.id);
    handleDialogDismiss();
    load();
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
        <AppText variant="h2">Account Types</AppText>
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
          {types.length === 0 ? (
            <EmptyState icon="sliders" title="No account types" subtitle="Tap + to add one" />
          ) : (
            types.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => handleEditPress(t)}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${t.name}`}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.iconCircle}>
                  <Feather name="sliders" size={18} color={theme.colors.textSecondary} />
                </View>
                <View style={styles.rowMain}>
                  <AppText variant="body">{t.name}</AppText>
                  {t.allowsOverdraft ? (
                    <AppText variant="bodySm" color="textMuted">Allows overdraft</AppText>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => handleDeletePress(t)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${t.name}`}
                  hitSlop={8}
                  style={styles.deleteBtn}
                >
                  <Feather name="trash-2" size={16} color={theme.colors.textMuted} />
                </Pressable>
                <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      <FAB onPress={handleAddPress} accessibilityLabel="Add account type" />

      <AccountTypeSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSuccess={load}
        initial={editTarget}
      />

      <ConfirmDialog
        visible={pendingDelete !== null}
        title={deleteBlocked ? 'Cannot Delete' : 'Delete Account Type'}
        message={
          deleteBlocked
            ? `"${pendingDelete?.name}" is used by an account and cannot be deleted.`
            : `Delete "${pendingDelete?.name}"? This cannot be undone.`
        }
        confirmLabel={deleteBlocked ? 'OK' : 'Delete'}
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
  scroll: { paddingHorizontal: theme.spacing[5] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[4],
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  rowPressed: { opacity: 0.6 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: { flex: 1, gap: theme.spacing[1] },
  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
