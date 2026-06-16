import React, { useState, useCallback } from 'react';
import {
  View, ScrollView, FlatList, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FAB } from '../../src/components/ui/FAB';
import { ListItem } from '../../src/components/ui/ListItem';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { AddTransactionSheet } from '../../src/components/dashboard/AddTransactionSheet';
import { accountRepo, categoryRepo, transactionRepo } from '../../src/repositories';
import { monthRangeIso, displayDate } from '../../src/utils/date';
import { formatPHP, formatAmount } from '../../src/utils/currency';
import { theme } from '../../src/theme';
import type { Account, Transaction, AccountType } from '../../src/domain/types';

const ACCOUNT_ICON: Record<AccountType, React.ComponentProps<typeof Feather>['name']> = {
  Cash: 'dollar-sign',
  Bank: 'credit-card',
  EWallet: 'smartphone',
  Other: 'briefcase',
};

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [totalBalance, setTotalBalance] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [monthIncome, setMonthIncome] = useState(0);
  const [monthExpense, setMonthExpense] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = monthRangeIso();
    const [accs, cats, allTxns, monthTxns] = await Promise.all([
      accountRepo.list(),
      categoryRepo.list(),
      transactionRepo.list(),
      transactionRepo.list({ from, to }),
    ]);
    setAccounts(accs);
    setTotalBalance(accs.reduce((s, a) => s + a.currentBalance, 0));
    setCategoryMap(Object.fromEntries(cats.map((c) => [c.id, c.name])));
    setRecentTxns(allTxns.slice(0, 5));
    setMonthIncome(monthTxns.filter((t) => t.type === 'Income').reduce((s, t) => s + t.amount, 0));
    setMonthExpense(monthTxns.filter((t) => t.type === 'Expense').reduce((s, t) => s + t.amount, 0));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={theme.colors.accentPrimary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 80 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <AppText variant="h2">Dashboard</AppText>
          </View>

          {/* Hero Balance Card — goldGlow shadow per design spec */}
          <View style={styles.heroCard}>
            <AppText variant="labelSm" color="textSecondary" style={styles.heroLabel}>
              TOTAL BALANCE
            </AppText>
            <View style={styles.heroAmount}>
              <AppText variant="amountMd" color="textSecondary" style={styles.currencySymbol}>
                ₱
              </AppText>
              <AppText variant="displayLg" color="textPrimary">
                {formatAmount(totalBalance)}
              </AppText>
            </View>
          </View>

          <SectionHeader
            title="Accounts"
            action={
              <Pressable
                onPress={() => router.push('/accounts')}
                accessibilityRole="button"
                accessibilityLabel="See all accounts"
              >
                <AppText variant="label" color="accentPrimary">See all</AppText>
              </Pressable>
            }
          />
          {accounts.length === 0 ? (
            <AppText variant="bodySm" color="textMuted" style={styles.emptyHint}>
              No accounts found
            </AppText>
          ) : (
            <FlatList
              data={accounts}
              keyExtractor={(a) => a.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.accountsList}
              renderItem={({ item }) => (
                <View
                  style={styles.accountCard}
                  accessibilityLabel={`${item.name}, ${item.type}, ${formatPHP(item.currentBalance)}`}
                >
                  <Feather
                    name={ACCOUNT_ICON[item.type]}
                    size={16}
                    color={theme.colors.accentPrimary}
                  />
                  <AppText variant="bodySm" numberOfLines={1} style={styles.accountName}>
                    {item.name}
                  </AppText>
                  <AppText
                    variant="amountSm"
                    color={item.currentBalance >= 0 ? 'textPrimary' : 'negative'}
                  >
                    {formatPHP(item.currentBalance)}
                  </AppText>
                </View>
              )}
            />
          )}

          <SectionHeader title="This Month" />
          <View style={styles.monthCard}>
            <View style={styles.monthCol}>
              <AppText variant="labelLg" color="positive">▲ Income</AppText>
              <AppText variant="amountMd" color="positive">{formatPHP(monthIncome)}</AppText>
            </View>
            <View style={styles.monthDivider} />
            <View style={styles.monthCol}>
              <AppText variant="labelLg" color="negative">▼ Expense</AppText>
              <AppText variant="amountMd" color="negative">{formatPHP(monthExpense)}</AppText>
            </View>
          </View>

          <SectionHeader title="Recent" />
          {recentTxns.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="No transactions yet"
              subtitle="Tap + to record your first transaction"
            />
          ) : (
            recentTxns.map((txn) => (
              <ListItem
                key={txn.id}
                icon={txn.type === 'Income' ? 'arrow-down-left' : 'arrow-up-right'}
                iconColor={txn.type === 'Income' ? theme.colors.positive : theme.colors.negative}
                title={categoryMap[txn.categoryId] ?? 'Unknown'}
                subtitle={displayDate(txn.date)}
                accessibilityLabel={`${categoryMap[txn.categoryId] ?? 'Unknown'}, ${txn.type}, ${formatPHP(txn.amount)}, ${displayDate(txn.date)}`}
                trailing={
                  <AppText
                    variant="amountSm"
                    color={txn.type === 'Income' ? 'positive' : 'negative'}
                  >
                    {txn.type === 'Expense' ? '-' : '+'}{formatPHP(txn.amount)}
                  </AppText>
                }
              />
            ))
          )}
        </ScrollView>
      )}

      <FAB onPress={() => setSheetVisible(true)} accessibilityLabel="Add transaction" />

      <AddTransactionSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSuccess={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[4],
  },
  header: {
    marginTop: theme.spacing[6],
    marginBottom: theme.spacing[2],
  },
  heroCard: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[6],
    ...theme.shadows.goldGlow,
  },
  heroLabel: {
    letterSpacing: 1.2,
    marginBottom: theme.spacing[3],
  },
  heroAmount: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing[2],
  },
  currencySymbol: {
    paddingBottom: theme.spacing[2],
  },
  accountsList: {
    paddingRight: theme.spacing[5],
    gap: theme.spacing[4],
  },
  accountCard: {
    width: 140,
    height: 80,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[4],
    justifyContent: 'space-between',
    ...theme.shadows.sm,
  },
  accountName: {
    color: theme.colors.textSecondary,
  },
  emptyHint: {
    marginVertical: theme.spacing[4],
  },
  monthCard: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
    flexDirection: 'row',
    ...theme.shadows.sm,
  },
  monthCol: {
    flex: 1,
    gap: theme.spacing[2],
  },
  monthDivider: {
    width: 1,
    backgroundColor: theme.colors.borderDefault,
    marginHorizontal: theme.spacing[4],
  },
});
