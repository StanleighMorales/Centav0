import React, { useState, useCallback, useRef } from 'react';
import { View, FlatList, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { Amount } from '../../src/components/ui/Amount';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FAB } from '../../src/components/ui/FAB';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { AddLendingSheet } from '../../src/components/lending/AddLendingSheet';
import { lendingRepo, lendingPaymentRepo, lendingPersonRepo, accountRepo } from '../../src/repositories';
import { theme } from '../../src/theme';
import { displayDate, monthRangeIso } from '../../src/utils/date';
import { formatPHP } from '../../src/utils/currency';
import type { Account, Lending, LendingPerson, LendingStatus } from '../../src/domain/types';

const TABS: LendingStatus[] = ['Active', 'Paid'];
const ALL_PEOPLE = '__all__';

type LendingRowProps = {
  lending: Lending;
  personName: string;
  paidTotal: number;
  onPress: (l: Lending) => void;
  onEdit: (l: Lending) => void;
};

function LendingRow({ lending, personName, paidTotal, onPress, onEdit }: LendingRowProps) {
  const swipeRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={() => { swipeRef.current?.close(); onEdit(lending); }}
          accessibilityRole="button"
          accessibilityLabel={`Edit lending to ${personName}`}
          style={styles.editAction}
        >
          <Feather name="edit-2" size={18} color={theme.colors.textPrimary} />
          <AppText variant="labelSm" color="textPrimary">Edit</AppText>
        </Pressable>
      )}
    >
      <Pressable
        onPress={() => onPress(lending)}
        accessibilityRole="button"
        accessibilityLabel={`View lending to ${personName}`}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={styles.iconCircle}>
          <Feather
            name="user"
            size={18}
            color={lending.status === 'Paid' ? theme.colors.positive : theme.colors.accentPrimary}
          />
        </View>
        <View style={styles.rowMain}>
          <AppText variant="body" style={styles.person}>{personName}</AppText>
          <AppText variant="bodySm" color="textMuted">{displayDate(lending.date)}</AppText>
        </View>
        <View style={styles.rowTrail}>
          {lending.status === 'Paid' ? (
            <View style={styles.paidTrail}>
              <AppText variant="labelSm" color="positive">PAID</AppText>
              <Amount value={paidTotal} variant="amountSm" semanticColor={false} color="positive" />
            </View>
          ) : (
            <Amount value={lending.outstandingBalance} variant="amountSm" semanticColor={false} />
          )}
          <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
        </View>
      </Pressable>
    </Swipeable>
  );
}

export default function LentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LendingStatus>('Active');
  const [personFilter, setPersonFilter] = useState(ALL_PEOPLE);
  const [lendings, setLendings] = useState<Lending[]>([]);
  const [people, setPeople] = useState<LendingPerson[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editLending, setEditLending] = useState<Lending | null>(null);
  const [paidTotals, setPaidTotals] = useState<Record<string, number>>({});
  const [paidBackThisMonth, setPaidBackThisMonth] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const all = await lendingRepo.list();
    const ppl = await lendingPersonRepo.list();
    const accs = await accountRepo.list();
    const allPayments = await lendingPaymentRepo.list();
    const totals: Record<string, number> = {};
    for (const p of allPayments) totals[p.lendingId] = (totals[p.lendingId] ?? 0) + p.amount;
    const { from, to } = monthRangeIso();
    const monthTotal = allPayments
      .filter((p) => p.date >= from && p.date <= to)
      .reduce((sum, p) => sum + p.amount, 0);
    setLendings(all);
    setPeople(ppl);
    setAccounts(accs);
    setPaidTotals(totals);
    setPaidBackThisMonth(monthTotal);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const personMap = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const byStatus = lendings.filter((l) => l.status === activeTab);
  const filtered = personFilter === ALL_PEOPLE ? byStatus : byStatus.filter((l) => l.personId === personFilter);
  const activeLendings = lendings.filter((l) => l.status !== 'Paid');
  const totalLentOut = activeLendings.reduce((sum, l) => sum + l.outstandingBalance, 0);
  const availableFunds = accounts
    .filter((a) => a.type === 'Cash' || a.type === 'EWallet')
    .reduce((sum, a) => sum + a.currentBalance, 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.headerWrap}>
        <ScreenHeader title="Lent" />
      </View>

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

      {people.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}
        >
          {[{ id: ALL_PEOPLE, name: 'All' }, ...people].map((p) => {
            const active = personFilter === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPersonFilter(p.id)}
                accessibilityRole="button"
                accessibilityLabel={p.name}
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <AppText variant="labelSm" color={active ? 'accentPrimary' : 'textSecondary'}>{p.name}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

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
          ListHeaderComponent={
            <View style={styles.summary}>
              <View style={styles.summaryCol}>
                <AppText variant="labelSm" color="textMuted">LENT OUT</AppText>
                <AppText variant="amountMd" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {formatPHP(totalLentOut)}
                </AppText>
                <AppText variant="bodySm" color="textMuted">{activeLendings.length} active</AppText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <AppText variant="labelSm" color="textMuted">CASH + E-WALLETS</AppText>
                <AppText variant="amountMd" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {formatPHP(availableFunds)}
                </AppText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <AppText variant="labelSm" color="textMuted">PAID BACK THIS MONTH</AppText>
                <AppText variant="amountMd" color="positive" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {formatPHP(paidBackThisMonth)}
                </AppText>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title={`No ${activeTab.toLowerCase()} lendings`}
              subtitle={activeTab === 'Paid' ? 'Paid-back lendings will appear here' : 'Tap + to record money you lent out'}
            />
          }
          renderItem={({ item }) => (
            <LendingRow
              lending={item}
              personName={personMap[item.personId] ?? 'Unknown'}
              paidTotal={paidTotals[item.id] ?? 0}
              onPress={(l) => router.push(`/lent/${l.id}`)}
              onEdit={setEditLending}
            />
          )}
        />
      )}

      <FAB onPress={() => setSheetVisible(true)} accessibilityLabel="Add lending" />

      <AddLendingSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSuccess={load}
      />

      <AddLendingSheet
        visible={editLending !== null}
        initial={editLending ?? undefined}
        onClose={() => setEditLending(null)}
        onSuccess={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  headerWrap: {
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
  chipsScroll: { flexGrow: 0, marginBottom: theme.spacing[4] },
  chips: { paddingHorizontal: theme.spacing[5], gap: theme.spacing[2] },
  chip: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.bgInput,
  },
  chipActive: { borderColor: theme.colors.accentBorder, backgroundColor: theme.colors.accentSubtle },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: theme.spacing[5] },
  summary: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
    flexDirection: 'row',
    gap: theme.spacing[4],
    marginBottom: theme.spacing[4],
    ...theme.shadows.sm,
  },
  summaryCol: { flex: 1, gap: theme.spacing[2] },
  summaryDivider: { width: 1, backgroundColor: theme.colors.borderDefault, marginHorizontal: theme.spacing[1] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.bgPrimary,
  },
  editAction: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    backgroundColor: theme.colors.bgElevated,
  },
  rowPressed: { opacity: 0.6 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing[4],
  },
  rowMain: { flex: 1, gap: theme.spacing[1] },
  person: { fontWeight: '600' },
  rowTrail: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  paidTrail: { alignItems: 'flex-end', gap: theme.spacing[1] },
});
