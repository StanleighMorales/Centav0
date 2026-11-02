import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { Segmented } from '../../src/components/ui/Segmented';
import { DebtsView } from '../../src/components/ledger/DebtsView';
import { LentView } from '../../src/components/ledger/LentView';
import { theme, makeStyles, useTheme } from '../../src/theme';

const SECTIONS = ['Debts', 'Lent'] as const;
type Section = (typeof SECTIONS)[number];

export default function LedgerScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const [section, setSection] = useState<Section>('Debts');
  // Each view opens its own add sheet when its signal changes.
  const [signals, setSignals] = useState<Record<Section, number>>({ Debts: 0, Lent: 0 });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <AppText variant="h1">Ledger</AppText>
        <Pressable
          onPress={() => setSignals((s) => ({ ...s, [section]: s[section] + 1 }))}
          accessibilityRole="button"
          accessibilityLabel={section === 'Debts' ? 'Add debt' : 'Add lending'}
          style={styles.addBtn}
        >
          <Feather name="plus" size={20} color={colors.accentText} />
        </Pressable>
      </View>
      <View style={styles.segWrap}>
        <Segmented options={SECTIONS} value={section} onChange={setSection} />
      </View>
      {section === 'Debts' ? <DebtsView addSignal={signals.Debts} /> : <LentView addSignal={signals.Lent} />}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[5],
    marginTop: theme.spacing[5],
    marginBottom: theme.spacing[4],
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: c.accentBorder,
    backgroundColor: c.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segWrap: { paddingHorizontal: theme.spacing[5], marginBottom: theme.spacing[4] },
}));
