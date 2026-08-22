const PHP_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PHP_FORMATTER_NO_SYMBOL = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// ponytail: fixed-width mask so a hidden balance doesn't leak its magnitude
export const HIDDEN_AMOUNT = '••••••';

export function formatPHP(amount: number): string {
  return PHP_FORMATTER.format(amount);
}

export function formatAmount(amount: number): string {
  return PHP_FORMATTER_NO_SYMBOL.format(amount);
}

export function roundCentavos(amount: number): number {
  return Math.round(amount * 100) / 100;
}
