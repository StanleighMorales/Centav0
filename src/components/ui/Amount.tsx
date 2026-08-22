import React from 'react';
import { AppText } from './AppText';
import { formatPHP, HIDDEN_AMOUNT } from '../../utils/currency';
import type { ColorKey, TypographyKey } from '../../theme';

type Props = {
  value: number;
  variant?: TypographyKey;
  color?: ColorKey;
  semanticColor?: boolean;
  hidden?: boolean;
};

// ponytail: semanticColor=false for neutral contexts (e.g. account balance, not expense/income)
export function Amount({ value, variant = 'amountSm', color, semanticColor = true, hidden = false }: Props) {
  const resolvedColor: ColorKey = color ?? (semanticColor ? (value < 0 ? 'negative' : 'positive') : 'textPrimary');
  return (
    <AppText variant={variant} color={resolvedColor}>
      {hidden ? HIDDEN_AMOUNT : formatPHP(value)}
    </AppText>
  );
}
