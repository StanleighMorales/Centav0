import React, { useState, useCallback } from 'react';
import { View, FlatList, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { Amount } from '../../src/components/ui/Amount';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FAB } from '../../src/components/ui/FAB';
import { AddInvestmentSheet } from '../../src/components/investments/AddInvestmentSheet';
import { investmentRepo } from '../../src/repositories';
import { investmentStats, formatPct, type InvestmentStats } from '../../src/utils/investments';
import { formatPHP } from '../../src/utils/currency';
import { theme, makeStyles, useTheme } from '../../src/theme';
import type { Investment } from '../../src/domain/types';

type Row = { inv: Investment; stats: InvestmentStats };

export default function InvestmentsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);

  const load = useCallback(async () => {
    const [list, updates] = await Promise.all([investmentRepo.list(), investmentRepo.listAllUpdates()]);
    setRows(list.map((inv) => ({ inv, stats: investmentStats(inv, updates.filter((u) => u.investmentId === inv.id)) })));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const active = rows.filter((r) => r.inv.status === 'Active');
  const paid = active.reduce((s, r) => s + r.inv.amountPaid, 0);
  const returned = active.reduce((s, r) => s + r.stats.returned, 0);
  const net = returned - paid;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="chevron-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <AppText variant="h2">Investments</AppText>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.inv.id}
        contentContainerStyle={[styles.list, rows.length === 0 && styles.listEmpty, { paddingBottom: 96 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={rows.length === 0 ? null : (
          <View style={styles.hero}>
            <AppText variant="labelSm" color="textMuted">NET POSITION</AppText>
            <Amount value={net} variant="amountLg" />
            <View style={styles.heroRow}>
              <View style={styles.flex}>
                <AppText variant="labelSm" color="textMuted">PUT IN</AppText>
                <AppText variant="amountMd">{formatPHP(paid)}</AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="labelSm" color="textMuted">RETURNED</AppText>
                <AppText variant="amountMd" color="positive">+{formatPHP(returned)}</AppText>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={loading ? null : (
          <EmptyState icon="trending-up" title="No investments yet" subtitle="Tap + to add a stake, attach its contract and log returns" />
        )}
        renderItem={({ item: { inv, stats } }) => (
          <Pressable
            onPress={() => router.push(`/investments/${inv.id}` as any)}
            accessibilityRole="button"
            accessibilityLabel={`${inv.name}, ${inv.amountPaid > 0 ? `paid ${formatPHP(inv.amountPaid)}` : 'free stake'}`}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.cardTop}>
              <View style={styles.flex}>
                <AppText variant="h4" numberOfLines={1}>{inv.name}</AppText>
                <AppText variant="bodySm" color="textMuted">
                  {inv.amountPaid > 0 ? `Paid ${formatPHP(inv.amountPaid)}` : 'Free stake'}
                  {stats.stakePct != null ? ` · ${formatPct(stats.stakePct)} stake` : ''}
                  {inv.status === 'Exited' ? ' · Exited' : ''}
                </AppText>
              </View>
              <View style={[styles.pill, stats.roiPct != null && stats.roiPct > 0 && styles.pillPositive]}>
                <AppText variant="labelSm" color={stats.roiPct != null && stats.roiPct > 0 ? 'positive' : 'textMuted'}>
                  {stats.roiPct == null ? 'No cost' : `${formatPct(stats.roiPct)} ROI`}
                </AppText>
              </View>
            </View>
            {inv.amountPaid > 0 && (
              <View style={styles.track}><View style={[styles.fill, { width: `${stats.progress * 100}%` }]} /></View>
            )}
            <AppText variant="bodySm" color="textMuted">
              {stats.returned > 0 ? `Returned ${formatPHP(stats.returned)}` : 'No returns yet'}
            </AppText>
          </Pressable>
        )}
      />
      <FAB onPress={() => setSheetVisible(true)} accessibilityLabel="Add investment" />
      <AddInvestmentSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} onSuccess={load} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing[5], paddingVertical: theme.spacing[4] },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginHorizontal: -theme.spacing[2] },
  flex: { flex: 1 },
  list: { paddingHorizontal: theme.spacing[5], gap: theme.spacing[3] },
  listEmpty: { flex: 1, justifyContent: 'center' },
  hero: {
    padding: theme.spacing[5],
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: c.accentBorder,
    backgroundColor: c.heroFrom,
    gap: theme.spacing[1],
    marginBottom: theme.spacing[2],
  },
  heroRow: { flexDirection: 'row', gap: theme.spacing[4], marginTop: theme.spacing[4], paddingTop: theme.spacing[4], borderTopWidth: 1, borderTopColor: c.accentBorder },
  card: {
    backgroundColor: c.bgSurface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: c.borderDefault,
    padding: theme.spacing[5],
    gap: theme.spacing[3],
  },
  pressed: { opacity: 0.85 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[3] },
  pill: { paddingHorizontal: theme.spacing[3], paddingVertical: 2, borderRadius: 99, backgroundColor: c.bgElevated, borderWidth: 1, borderColor: c.borderDefault },
  pillPositive: { backgroundColor: c.positiveBg, borderColor: 'transparent' },
  track: { height: 5, borderRadius: 3, backgroundColor: c.bgElevated, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: c.accentPrimary },
}));
