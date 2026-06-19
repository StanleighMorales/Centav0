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

export function formatPHP(amount: number): string {
  return PHP_FORMATTER.format(amount);
}

export function formatAmount(amount: number): string {
  return PHP_FORMATTER_NO_SYMBOL.format(amount);
}

export function roundCentavos(amount: number): number {
  return Math.round(amount * 100) / 100;
}
