import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AppText } from '../ui/AppText';
import { Amount } from '../ui/Amount';
import { displayDateTime } from '../../utils/date';
import { theme } from '../../theme';
import type { Transaction } from '../../domain/types';

type Props = {
  transaction: Transaction | null;
  categoryName: string;
  accountName: string;
  toAccountName?: string;
  onClose: () => void;
};

export function TransactionDetailSheet({ transaction, categoryName, accountName, toAccountName, onClose }: Props) {
  if (!transaction) {
    return <BottomSheet visible={false} onClose={onClose}><View /></BottomSheet>;
  }

  const isTransfer = transaction.type === 'Transfer';

  return (
    <BottomSheet visible={transaction !== null} onClose={onClose} title="Transaction Detail">
      <View style={styles.body}>
        <Amount
          value={transaction.amount}
          variant="amountLg"
          semanticColor={!isTransfer}
          color={isTransfer ? 'textPrimary' : undefined}
        />
        <View style={styles.row}>
          <AppText variant="labelSm" color="textMuted">DATE</AppText>
          <AppText variant="body">{displayDateTime(transaction.date)}</AppText>
        </View>
        {isTransfer ? (
          <>
            <View style={styles.row}>
              <AppText variant="labelSm" color="textMuted">FROM</AppText>
              <AppText variant="body">{accountName}</AppText>
            </View>
            <View style={styles.row}>
              <AppText variant="labelSm" color="textMuted">TO</AppText>
              <AppText variant="body">{toAccountName ?? 'Unknown'}</AppText>
            </View>
          </>
        ) : (
          <>
            <View style={styles.row}>
              <AppText variant="labelSm" color="textMuted">CATEGORY</AppText>
              <AppText variant="body">{categoryName}</AppText>
            </View>
            <View style={styles.row}>
              <AppText variant="labelSm" color="textMuted">ACCOUNT</AppText>
              <AppText variant="body">{accountName}</AppText>
            </View>
          </>
        )}
        {transaction.note ? (
          <View style={styles.noteBlock}>
            <AppText variant="labelSm" color="textMuted">NOTE</AppText>
            <AppText variant="body">{transaction.note}</AppText>
          </View>
        ) : null}
        {transaction.receiptUri ? (
          <Image source={{ uri: transaction.receiptUri }} style={styles.image} resizeMode="cover" />
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: theme.spacing[4] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteBlock: { gap: theme.spacing[1] },
  image: {
    width: '100%',
    height: 220,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
    marginTop: theme.spacing[2],
  },
});
