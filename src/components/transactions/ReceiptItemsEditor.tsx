import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../ui/AppText';
import { AppTextInput } from '../ui/AppTextInput';
import { Amount } from '../ui/Amount';
import { theme, makeStyles, useTheme } from '../../theme';
import { roundCentavos } from '../../utils/currency';
import type { TransactionItemInput } from '../../domain/types';

type Props = {
  items: TransactionItemInput[];
  onChange: (items: TransactionItemInput[]) => void;
  /** Transaction total, to show how far the items are from it (tax, discounts). */
  total: number;
};

const toNum = (s: string) => {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

// Keeps the raw typed text so "12." survives while typing; the parent only sees numbers.
function ItemRow({ item, onChange, onRemove }: {
  item: TransactionItemInput;
  onChange: (item: TransactionItemInput) => void;
  onRemove: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [qty, setQty] = useState(String(item.qty));
  const [price, setPrice] = useState(item.price > 0 ? String(item.price) : '');

  return (
    <View style={styles.row}>
      <View style={styles.nameCol}>
        <AppTextInput label="Item" value={item.name} onChangeText={(name) => onChange({ ...item, name })} placeholder="Item name" />
      </View>
      <View style={styles.qtyCol}>
        <AppTextInput label="Qty" numeric value={qty} onChangeText={(t) => { setQty(t); onChange({ ...item, qty: toNum(t) }); }} />
      </View>
      <View style={styles.priceCol}>
        <AppTextInput label="Price" numeric value={price} onChangeText={(t) => { setPrice(t); onChange({ ...item, price: toNum(t) }); }} placeholder="0.00" />
      </View>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.name || 'item'}`}
        hitSlop={8}
        style={styles.remove}
      >
        <Feather name="trash-2" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

export function ReceiptItemsEditor({ items, onChange, total }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const itemsSum = roundCentavos(items.reduce((s, i) => s + i.qty * i.price, 0));
  const diff = roundCentavos(total - itemsSum);

  return (
    <View style={styles.wrap}>
      <AppText variant="labelLg" color="textSecondary">Items</AppText>
      {items.map((item, i) => (
        <ItemRow
          key={i}
          item={item}
          onChange={(next) => onChange(items.map((it, j) => (j === i ? next : it)))}
          onRemove={() => onChange(items.filter((_, j) => j !== i))}
        />
      ))}
      <Pressable
        onPress={() => onChange([...items, { name: '', qty: 1, price: 0 }])}
        accessibilityRole="button"
        accessibilityLabel="Add item"
        style={styles.add}
      >
        <Feather name="plus" size={18} color={colors.accentPrimary} />
        <AppText variant="body" color="accentPrimary">Add item</AppText>
      </Pressable>
      {items.length > 0 ? (
        <View style={styles.diffRow}>
          <AppText variant="labelSm" color="textMuted">
            {diff === 0 ? 'ITEMS MATCH TOTAL' : 'DIFFERENCE (TAX, DISCOUNTS)'}
          </AppText>
          {diff !== 0 ? <Amount value={diff} variant="amountSm" color="textSecondary" /> : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: theme.spacing[3] },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[3] },
  nameCol: { flex: 1 },
  qtyCol: { width: 52 },
  priceCol: { width: 84 },
  remove: { width: 32, height: 52, alignItems: 'center', justifyContent: 'center' },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    paddingVertical: theme.spacing[4],
    paddingHorizontal: theme.spacing[5],
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: c.accentBorder,
    backgroundColor: c.accentSubtle,
  },
  diffRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
}));
