import React, { useState, useCallback } from 'react';
import {
  View, SectionList, Pressable, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../src/components/ui/AppText';
import { ListItem } from '../../src/components/ui/ListItem';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { transactionRepo, categoryRepo } from '../../src/repositories';
import { displayDate } from '../../src/utils/date';
import { formatPHP } from '../../src/utils/currency';
import { theme } from '../../src/theme';
import type { Transaction, TransactionType } from '../../src/domain/types';

type Filter = 'All' | TransactionType;
const FILTERS: Filter[] = ['All', 'Expense', 'Income'];

function groupByDate(txns: Transaction[]): { title: string; data: Transaction[] }[] {
  const map = new Map<string, Transaction[]>();
  for (const t of txns) {
    const key = displayDate(t.date);
    const bucket = map.get(key);
    if (bucket) bucket.push(t);
    else map.set(key, [t]);
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('All');
  const [sections, setSections] = useState<{ title: string; data: Transaction[] }[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});

  const load = useCallback(async (activeFilter: Filter) => {
    setLoading(true);
    const txns = await transactionRepo.list(activeFilter !== 'All' ? { type: activeFilter } : undefined);
    const cats = await categoryRepo.list();
    setCategoryMap(Object.fromEntries(cats.map((c) => [c.id, c.name])));
    setSections(groupByDate(txns));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(filter); }, [filter, load]));

  const handleFilter = (f: Filter) => {
    setFilter(f);
    load(f);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <AppText variant="h2">Transactions</AppText>
      </View>

      <View style={styles.chips}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => handleFilter(f)}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${f}`}
            accessibilityState={{ selected: filter === f }}
            style={[styles.chip, filter === f && styles.chipActive]}
          >
            <AppText
              variant="labelLg"
              color={filter === f ? 'accentPrimary' : 'textSecondary'}
            >
              {f}
            </AppText>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={theme.colors.accentPrimary} size="large" />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: theme.spacing[7] + insets.bottom },
          ]}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <AppText variant="label" color="textMuted" style={styles.sectionHeader}>
              {section.title.toUpperCase()}
            </AppText>
          )}
          renderItem={({ item }) => (
            <ListItem
              icon={item.type === 'Income' ? 'arrow-down-left' : 'arrow-up-right'}
              iconColor={item.type === 'Income' ? theme.colors.positive : theme.colors.negative}
              title={categoryMap[item.categoryId] ?? 'Unknown'}
              subtitle={item.note ?? undefined}
              accessibilityLabel={`${categoryMap[item.categoryId] ?? 'Unknown'}, ${item.type}, ${formatPHP(item.amount)}, ${displayDate(item.date)}`}
              trailing={
                <AppText
                  variant="amountSm"
                  color={item.type === 'Income' ? 'positive' : 'negative'}
                >
                  {item.type === 'Expense' ? '−' : '+'}{formatPHP(item.amount)}
                </AppText>
              }
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="list"
              title="No transactions"
              subtitle={
                filter === 'All'
                  ? 'Tap + on the Dashboard to add one'
                  : `No ${filter.toLowerCase()} transactions found`
              }
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  header: {
    paddingHorizontal: theme.spacing[5],
    marginTop: theme.spacing[6],
    marginBottom: theme.spacing[4],
  },
  chips: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[3],
    marginBottom: theme.spacing[5],
  },
  chip: {
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  chipActive: {
    borderColor: theme.colors.accentBorder,
    backgroundColor: theme.colors.accentSubtle,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: theme.spacing[5],
  },
  sectionHeader: {
    letterSpacing: 1,
    marginTop: theme.spacing[5],
    marginBottom: theme.spacing[3],
  },
});
