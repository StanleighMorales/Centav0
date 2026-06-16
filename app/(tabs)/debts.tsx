import React, { useState, useCallback } from 'react';
import { View, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { Amount } from '../../src/components/ui/Amount';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FAB } from '../../src/components/ui/FAB';
import { AddDebtSheet } from '../../src/components/debts/AddDebtSheet';
import { debtRepo } from '../../src/repositories';
import { theme } from '../../src/theme';
import { displayDate } from '../../src/utils/date';
import type { Debt, DebtStatus } from '../../src/domain/types';

const TABS: DebtStatus[] = ['Open', 'Overdue', 'Paid'];

export default function DebtsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DebtStatus>('Open');
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const all = await debtRepo.list();
    setDebts(all);
    setLoading(false);
  }, []);

  useFocusEffect(load);

  const filtered = debts.filter((d) => d.status === activeTab);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppText variant="h2" style={styles.title}>Debts</AppText>

      <View style={styles.tabRow}>
        {TABS.map((tab) => (
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
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: 80 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="credit-card"
              title={`No ${activeTab.toLowerCase()} debts`}
              subtitle={activeTab === 'Paid' ? 'Paid debts will appear here' : 'Tap + to add a debt'}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/debts/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`View debt from ${item.creditor}`}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowMain}>
                <AppText variant="body" style={styles.creditor}>{item.creditor}</AppText>
                {item.dueDate ? (
                  <AppText
                    variant="bodySm"
                    color={item.status === 'Overdue' ? 'negative' : 'textMuted'}
                  >
                    Due {displayDate(item.dueDate)}
                  </AppText>
                ) : null}
              </View>
              <View style={styles.rowTrail}>
                <Amount value={item.outstandingBalance} variant="amountSm" semanticColor={false} />
                <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
              </View>
            </Pressable>
          )}
        />
      )}

      <FAB onPress={() => setSheetVisible(true)} accessibilityLabel="Add debt" />

      <AddDebtSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSuccess={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  title: {
    paddingHorizontal: theme.spacing[5],
    marginTop: theme.spacing[5],
    marginBottom: theme.spacing[4],
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[3],
    marginBottom: theme.spacing[4],
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
  list: { paddingHorizontal: theme.spacing[5] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  rowPressed: { opacity: 0.6 },
  rowMain: { flex: 1, gap: theme.spacing[1] },
  creditor: { fontWeight: '600' },
  rowTrail: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
});
