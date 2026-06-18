import React, { useState, useCallback } from 'react';
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { CategoryIcon } from '../../src/components/ui/CategoryIcon';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FAB } from '../../src/components/ui/FAB';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { CategorySheet } from '../../src/components/categories/CategorySheet';
import { categoryRepo, transactionRepo } from '../../src/repositories';
import { theme } from '../../src/theme';
import type { Category, CategoryType } from '../../src/domain/types';

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CategoryType>('Expense');
  const [expenses, setExpenses] = useState<Category[]>([]);
  const [incomes, setIncomes] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | undefined>();
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const exp = await categoryRepo.list('Expense');
    const inc = await categoryRepo.list('Income');
    setExpenses(exp);
    setIncomes(inc);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const displayed = activeTab === 'Expense' ? expenses : incomes;

  function handleAddPress() {
    setEditTarget(undefined);
    setSheetVisible(true);
  }

  function handleEditPress(cat: Category) {
    setEditTarget(cat);
    setSheetVisible(true);
  }

  async function handleDeletePress(cat: Category) {
    const txns = await transactionRepo.list({ categoryId: cat.id });
    setDeleteBlocked(txns.length > 0);
    setPendingDelete(cat);
  }

  async function handleDeleteConfirm() {
    if (!pendingDelete || deleteBlocked) return;
    await categoryRepo.softDelete(pendingDelete.id);
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
        <AppText variant="h2">Categories</AppText>
      </View>

      <View style={styles.tabRow}>
        {(['Expense', 'Income'] as CategoryType[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="tab"
            accessibilityLabel={tab}
            accessibilityState={{ selected: activeTab === tab }}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
          >
            <AppText variant="labelLg" color={activeTab === tab ? 'accentPrimary' : 'textSecondary'}>
              {tab}
            </AppText>
          </Pressable>
        ))}
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
          {displayed.length === 0 ? (
            <EmptyState icon="tag" title="No categories" subtitle="Tap + to add one" />
          ) : (
            displayed.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => handleEditPress(cat)}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${cat.name}`}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={[styles.iconCircle, cat.color ? { backgroundColor: cat.color } : undefined]}>
                  <CategoryIcon
                    name={cat.icon ?? 'tag'}
                    size={18}
                    color={theme.colors.bgPrimary}
                  />
                </View>
                <AppText variant="body" style={styles.catName}>{cat.name}</AppText>
                <Pressable
                  onPress={() => handleDeletePress(cat)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${cat.name}`}
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

      <FAB onPress={handleAddPress} accessibilityLabel="Add category" />

      <CategorySheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSuccess={load}
        initial={editTarget}
        defaultType={activeTab}
      />

      <ConfirmDialog
        visible={pendingDelete !== null}
        title={deleteBlocked ? 'Cannot Delete' : 'Delete Category'}
        message={
          deleteBlocked
            ? `"${pendingDelete?.name}" has transactions and cannot be deleted.`
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
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[3],
    marginBottom: theme.spacing[5],
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing[3],
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: theme.colors.accentPrimary },
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
  catName: { flex: 1 },
  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
