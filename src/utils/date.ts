export function nowIso(): string {
  return new Date().toISOString();
}

export function toIso(input: Date | string): string {
  return input instanceof Date ? input.toISOString() : new Date(input).toISOString();
}

export function fromIso(iso: string): Date {
  return new Date(iso);
}

export function displayDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  });
}

export function displayDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
}

// ponytail: Manila is fixed UTC+8 (no DST), so use the offset directly.
// Round-tripping through toLocaleString breaks on Hermes (unparseable Date).
const MANILA_OFFSET = 8 * 60 * 60 * 1000;

function manilaParts(date: Date): { y: number; m: number; d: number } {
  const shifted = new Date(date.getTime() + MANILA_OFFSET);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

export function startOfDayManilaIso(date: Date = new Date()): string {
  const { y, m, d } = manilaParts(date);
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - MANILA_OFFSET).toISOString();
}

export function endOfDayManilaIso(date: Date = new Date()): string {
  const { y, m, d } = manilaParts(date);
  return new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - MANILA_OFFSET).toISOString();
}

export function monthRangeIso(date: Date = new Date()): { from: string; to: string } {
  const { y, m } = manilaParts(date);
  const from = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0) - MANILA_OFFSET).toISOString();
  const to = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999) - MANILA_OFFSET).toISOString();
  return { from, to };
}
