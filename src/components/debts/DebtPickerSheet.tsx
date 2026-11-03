import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { BottomSheet, SheetScrollView as ScrollView } from '../ui/BottomSheet';
import { ListItem } from '../ui/ListItem';
import { Amount } from '../ui/Amount';
import { EmptyState } from '../ui/EmptyState';
import { debtRepo } from '../../repositories';
import { displayDate } from '../../utils/date';
import { theme, makeStyles, useTheme } from '../../theme';
import type { Debt } from '../../domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (debt: Debt) => void;
};

// "Pay my monthly balance" without naming a debt: pick which one, soonest due first.
export function DebtPickerSheet({ visible, onClose, onPick }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [debts, setDebts] = useState<Debt[] | null>(null);

  useEffect(() => {
    if (!visible) { setDebts(null); return; }
    debtRepo.list().then((all) => setDebts(
      all
        .filter((d) => d.outstandingBalance > 0)
        // No due date sorts last.
        .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')),
    ));
  }, [visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Pay which debt?">
      <ScrollView showsVerticalScrollIndicator={false}>
        {debts === null ? (
          <ActivityIndicator color={colors.accentPrimary} style={styles.loading} />
        ) : debts.length === 0 ? (
          <EmptyState icon="check-circle" title="Nothing to pay" subtitle="You have no open debts" />
        ) : (
          debts.map((d) => (
            <ListItem
              key={d.id}
              title={d.creditor}
              subtitle={d.dueDate ? `Due ${displayDate(d.dueDate)}` : d.debtType}
              trailing={<Amount value={d.outstandingBalance} variant="amountSm" semanticColor={false} />}
              onPress={() => onPick(d)}
              accessibilityLabel={`Pay ${d.creditor}`}
            />
          ))
        )}
        <View style={styles.bottomPad} />
      </ScrollView>
    </BottomSheet>
  );
}

const useStyles = makeStyles(() => ({
  loading: { paddingVertical: theme.spacing[6] },
  bottomPad: { height: theme.spacing[5] },
}));
