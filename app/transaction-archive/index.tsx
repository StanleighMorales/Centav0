import React, { useState, useCallback } from 'react';
import { View, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { ListItem } from '../../src/components/ui/ListItem';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { Amount } from '../../src/components/ui/Amount';
import { transactionRepo, categoryRepo, accountRepo } from '../../src/repositories';
import { displayDate, displayDateTime } from '../../src/utils/date';
import { theme } from '../../src/theme';
import type { Transaction } from '../../src/domain/types';

export default function TransactionArchiveScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [accountMap, setAccountMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const deleted = await transactionRepo.listDeleted();
    const cats = await categoryRepo.list();
    const accs = await accountRepo.list();
    const deletedAccs = await accountRepo.listDeleted();
    setCategoryMap(Object.fromEntries(cats.map((c) => [c.id, c.name])));
    setAccountMap(Object.fromEntries([
      ...accs.map((a) => [a.id, a.name]),
      ...deletedAccs.map((a) => [a.id, `${a.name} (Deleted)`]),
    ]));
    setTxns(deleted);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
        <AppText variant="h2" style={styles.flex}>Transaction Archive</AppText>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={theme.colors.accentPrimary} size="large" />
        </View>
      ) : (
        <FlatList
          data={txns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: theme.spacing[7] + insets.bottom }]}
          renderItem={({ item }) => (
            <ListItem
              title={item.type === 'Transfer' ? accountMap[item.accountId] ?? 'Unknown' : categoryMap[item.categoryId ?? ''] ?? 'Unknown'}
              subtitle={`${accountMap[item.accountId] ?? 'Unknown account'} · ${displayDate(item.date)} · Deleted ${displayDateTime(item.deletedAt ?? item.updatedAt)}`}
              trailing={<Amount value={item.amount} variant="amountSm" semanticColor={false} />}
              accessibilityLabel={`Deleted transaction, ${item.type}`}
            />
          )}
          ListEmptyComponent={
            <EmptyState icon="archive" title="No deleted transactions" subtitle="Transactions you delete will show up here" />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[4],
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -theme.spacing[2],
  },
  flex: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: theme.spacing[5] },
});
