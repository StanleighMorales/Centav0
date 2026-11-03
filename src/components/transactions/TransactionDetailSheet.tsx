import React, { useEffect, useState } from 'react';
import { View, Image } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AppText } from '../ui/AppText';
import { Amount } from '../ui/Amount';
import { transactionItemRepo } from '../../repositories';
import { displayDateTime } from '../../utils/date';
import { theme, makeStyles } from '../../theme';
import type { Transaction, TransactionItem } from '../../domain/types';

type Props = {
  transaction: Transaction | null;
  categoryName: string;
  accountName: string;
  toAccountName?: string;
  onClose: () => void;
};

export function TransactionDetailSheet({ transaction, categoryName, accountName, toAccountName, onClose }: Props) {
  const styles = useStyles();
  const [items, setItems] = useState<TransactionItem[]>([]);
  const txId = transaction?.id;
  useEffect(() => {
    if (!txId) { setItems([]); return; }
    transactionItemRepo.listByTransaction(txId).then(setItems);
  }, [txId]);
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
        {items.length > 0 ? (
          <View style={styles.noteBlock}>
            <AppText variant="labelSm" color="textMuted">ITEMS</AppText>
            {items.map((it) => (
              <View key={it.id} style={styles.row}>
                <AppText variant="body" style={styles.itemName}>
                  {it.qty !== 1 ? `${it.qty} x ` : ''}{it.name}
                </AppText>
                <Amount value={it.qty * it.price} variant="amountSm" color="textSecondary" />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
  body: { gap: theme.spacing[4] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteBlock: { gap: theme.spacing[1] },
  itemName: { flex: 1, marginRight: theme.spacing[3] },
  image: {
    width: '100%',
    height: 220,
    borderRadius: theme.radius.md,
    backgroundColor: c.bgElevated,
    marginTop: theme.spacing[2],
  },
}));
