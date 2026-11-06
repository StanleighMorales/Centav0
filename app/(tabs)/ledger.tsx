import React, { useContext, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../src/components/ui/AppText';
import { Segmented } from '../../src/components/ui/Segmented';
import { DebtsView } from '../../src/components/ledger/DebtsView';
import { LentView } from '../../src/components/ledger/LentView';
import { LedgerAddContext } from '../../src/components/nav/FloatingTabBar';
import { theme, makeStyles } from '../../src/theme';

const SECTIONS = ['Debts', 'Lent'] as const;
type Section = (typeof SECTIONS)[number];

export default function LedgerScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const [section, setSection] = useState<Section>('Debts');
  // Only the open section is mounted, and it ignores the count it mounted with, so a tap adds to that section alone.
  const addSignal = useContext(LedgerAddContext);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <AppText variant="h1">Ledger</AppText>
      </View>
      <View style={styles.segWrap}>
        <Segmented options={SECTIONS} value={section} onChange={setSection} />
      </View>
      {section === 'Debts' ? <DebtsView addSignal={addSignal} /> : <LentView addSignal={addSignal} />}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bgPrimary },
  header: {
    paddingHorizontal: theme.spacing[5],
    marginTop: theme.spacing[5],
    marginBottom: theme.spacing[4],
  },
  segWrap: { paddingHorizontal: theme.spacing[5], marginBottom: theme.spacing[4] },
}));
