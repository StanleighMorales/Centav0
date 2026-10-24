import React, { useState, useCallback } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { Amount } from '../../src/components/ui/Amount';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { AddInvestmentSheet } from '../../src/components/investments/AddInvestmentSheet';
import { AddInvestmentUpdateSheet } from '../../src/components/investments/AddInvestmentUpdateSheet';
import { investmentRepo } from '../../src/repositories';
import { investmentStats, timeline, formatPct } from '../../src/utils/investments';
import { pickContractPdf, openContract, formatFileSize } from '../../src/utils/contracts';
import { displayDate } from '../../src/utils/date';
import { formatPHP } from '../../src/utils/currency';
import { theme, makeStyles, useTheme } from '../../src/theme';
import type { Investment, InvestmentUpdate, InvestmentDocument } from '../../src/domain/types';

type Pending = { kind: 'investment' } | { kind: 'update'; id: string } | { kind: 'document'; id: string } | null;

export default function InvestmentDetailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [inv, setInv] = useState<Investment | null>(null);
  const [updates, setUpdates] = useState<InvestmentUpdate[]>([]);
  const [docs, setDocs] = useState<InvestmentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);
  const [updateVisible, setUpdateVisible] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [fileError, setFileError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    const [i, u, d] = await Promise.all([investmentRepo.getById(id), investmentRepo.listUpdates(id), investmentRepo.listDocuments(id)]);
    setInv(i); setUpdates(u); setDocs(d); setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading || !inv) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        {loading ? <ActivityIndicator color={colors.accentPrimary} size="large" /> : <AppText variant="body" color="textMuted">Investment not found.</AppText>}
      </View>
    );
  }

  const stats = investmentStats(inv, updates);
  const rows = timeline(inv.amountPaid, updates);
  const exited = inv.status === 'Exited';

  async function attach() {
    setFileError('');
    try {
      const picked = await pickContractPdf();
      if (picked) { await investmentRepo.addDocument(inv!.id, picked); load(); }
    } catch (e) {
      setFileError(e instanceof Error ? e.message : 'Could not attach that file');
    }
  }

  async function open(uri: string) {
    setFileError('');
    try { await openContract(uri); } catch (e) { setFileError(e instanceof Error ? e.message : 'Could not open that file'); }
  }

  async function confirmDelete() {
    const p = pending;
    setPending(null);
    if (!p) return;
    if (p.kind === 'investment') { await investmentRepo.softDelete(inv!.id); router.back(); return; }
    if (p.kind === 'update') await investmentRepo.deleteUpdate(p.id);
    else await investmentRepo.deleteDocument(p.id);
    load();
  }

  const pendingText = pending?.kind === 'investment'
    ? { title: 'Delete Investment', message: `Delete "${inv.name}" with its updates and contracts? This cannot be undone.` }
    : pending?.kind === 'update'
      ? { title: 'Delete Update', message: 'Remove this update? Totals will be recalculated.' }
      : { title: 'Remove Contract', message: 'Remove this contract from the investment?' };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="chevron-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <AppText variant="h2" style={styles.flex} numberOfLines={1}>{inv.name}</AppText>
        <Pressable onPress={() => setEditVisible(true)} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Edit investment">
          <Feather name="edit-2" size={18} color={colors.accentPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <Card accent style={styles.hero}>
          <AppText variant="labelSm" color="textMuted">RETURNED SO FAR</AppText>
          <Amount value={stats.returned} variant="amountLg" semanticColor={false} color="positive" />
          <AppText variant="bodySm" color="textMuted">
            {stats.roiPct == null ? 'No amount paid, so no ROI %' : `${formatPct(stats.roiPct)} of ${formatPHP(inv.amountPaid)} paid`}
            {inv.expectedReturnPct != null ? ` · target ${formatPct(inv.expectedReturnPct)}` : ''}
          </AppText>
        </Card>

        <Card style={styles.stats}>
          <View style={styles.statCell}>
            <AppText variant="labelSm" color="textMuted">AMOUNT PAID</AppText>
            <AppText variant="amountMd">{inv.amountPaid > 0 ? formatPHP(inv.amountPaid) : 'None'}</AppText>
          </View>
          <View style={styles.statCell}>
            <AppText variant="labelSm" color="textMuted">STAKE</AppText>
            <AppText variant="amountMd">{stats.stakePct != null ? formatPct(stats.stakePct) : 'None'}</AppText>
          </View>
          <View style={styles.statCell}>
            <AppText variant="labelSm" color="textMuted">NET</AppText>
            <Amount value={stats.net} variant="amountMd" />
          </View>
          <View style={styles.statCell}>
            <AppText variant="labelSm" color="textMuted">SINCE</AppText>
            <AppText variant="bodySm">{displayDate(inv.startDate)}</AppText>
          </View>
        </Card>
        {inv.note ? <AppText variant="bodySm" color="textMuted" style={styles.note}>{inv.note}</AppText> : null}

        <View style={styles.sectionHead}>
          <AppText variant="h3">Contracts</AppText>
          <Pressable onPress={attach} accessibilityRole="button" accessibilityLabel="Attach contract PDF" style={styles.textBtn}>
            <Feather name="paperclip" size={14} color={colors.accentText} />
            <AppText variant="labelLg" color="accentText">Attach PDF</AppText>
          </Pressable>
        </View>
        {docs.length === 0 ? (
          <AppText variant="bodySm" color="textMuted">No contract attached yet.</AppText>
        ) : docs.map((d) => (
          <Pressable
            key={d.id}
            onPress={() => open(d.uri)}
            onLongPress={() => setPending({ kind: 'document', id: d.id })}
            accessibilityRole="button"
            accessibilityLabel={`Open ${d.name}. Long press to remove.`}
            style={({ pressed }) => [styles.docRow, pressed && styles.pressed]}
          >
            <View style={styles.pdfTile}><AppText variant="labelSm" color="negative">PDF</AppText></View>
            <View style={styles.flex}>
              <AppText variant="h4" numberOfLines={1}>{d.name}</AppText>
              <AppText variant="bodySm" color="textMuted">{formatFileSize(d.size)} · added {displayDate(d.createdAt)}</AppText>
            </View>
            <Feather name="external-link" size={16} color={colors.textMuted} />
          </Pressable>
        ))}
        {fileError ? <AppText variant="bodySm" color="negative">{fileError}</AppText> : null}

        <View style={styles.sectionHead}>
          <AppText variant="h3">Updates</AppText>
        </View>
        {!exited && <Button label="Add Update" onPress={() => setUpdateVisible(true)} />}
        {rows.length === 0 ? (
          <AppText variant="bodySm" color="textMuted">No updates yet. Log a return or a stake change when it happens.</AppText>
        ) : rows.map((u) => (
          <Pressable
            key={u.id}
            onLongPress={() => setPending({ kind: 'update', id: u.id })}
            accessibilityLabel={`${displayDate(u.date)}, ${u.amount > 0 ? formatPHP(u.amount) : 'stake update'}. Long press to delete.`}
            style={styles.updRow}
          >
            <View style={[styles.dot, u.amount === 0 && styles.dotHollow]} />
            <View style={styles.flex}>
              <AppText variant="amountSm" color={u.amount > 0 ? 'positive' : 'textPrimary'}>
                {u.amount > 0 ? `+${formatPHP(u.amount)}` : 'Stake update'}
              </AppText>
              <AppText variant="bodySm" color="textMuted">
                {displayDate(u.date)}
                {u.stakePct != null ? ` · stake now ${formatPct(u.stakePct)}` : ''}
                {u.runningRoiPct != null ? ` · running ROI ${formatPct(u.runningRoiPct)}` : ''}
              </AppText>
              {u.note ? <AppText variant="bodySm" color="textSecondary">{u.note}</AppText> : null}
            </View>
          </Pressable>
        ))}

        <Button
          label={exited ? 'Mark as Active' : 'Mark as Exited'}
          variant="secondary"
          onPress={async () => { await investmentRepo.update(inv.id, { status: exited ? 'Active' : 'Exited' }); load(); }}
        />
        <Pressable onPress={() => setPending({ kind: 'investment' })} accessibilityRole="button" accessibilityLabel="Delete investment" style={styles.deleteBtn}>
          <Feather name="trash-2" size={16} color={colors.negative} />
          <AppText variant="body" color="negative">Delete Investment</AppText>
        </Pressable>
      </ScrollView>

      <AddInvestmentSheet visible={editVisible} onClose={() => setEditVisible(false)} onSuccess={load} initial={inv} />
      <AddInvestmentUpdateSheet
        visible={updateVisible}
        onClose={() => setUpdateVisible(false)}
        onSuccess={load}
        investmentId={inv.id}
        investmentName={inv.name}
        amountPaid={inv.amountPaid}
        returned={stats.returned}
      />
      <ConfirmDialog
        visible={pending !== null}
        title={pendingText.title}
        message={pendingText.message}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
        destructive
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bgPrimary },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing[5], paddingVertical: theme.spacing[4] },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginHorizontal: -theme.spacing[2] },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: theme.spacing[5], gap: theme.spacing[4] },
  hero: { gap: theme.spacing[1] },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: theme.spacing[4] },
  statCell: { width: '50%', gap: theme.spacing[1] },
  note: { fontStyle: 'italic' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing[3] },
  textBtn: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], minHeight: 44, paddingLeft: theme.spacing[3] },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[4],
    padding: theme.spacing[4],
    borderRadius: theme.radius.md,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.borderDefault,
    minHeight: 64,
  },
  pdfTile: {
    width: 36, height: 44, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.borderStrong,
  },
  pressed: { opacity: 0.7 },
  updRow: { flexDirection: 'row', gap: theme.spacing[4], paddingVertical: theme.spacing[3], borderBottomWidth: 1, borderBottomColor: c.borderDefault },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: c.accentPrimary, borderWidth: 2, borderColor: c.accentPrimary },
  dotHollow: { backgroundColor: 'transparent' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing[2], paddingVertical: theme.spacing[5] },
}));
