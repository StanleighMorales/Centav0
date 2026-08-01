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

export type Period = 'day' | 'week' | 'month' | 'year';

const dayStart = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - MANILA_OFFSET).toISOString();
const dayEnd = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - MANILA_OFFSET).toISOString();

// Next occurrence of `dueDay` (1-31) on/after today, Manila time. Date.UTC
// clamps out-of-range days (e.g. dueDay=31 in Feb -> Feb 28/29).
export function nextDueDateIso(dueDay: number, from: Date = new Date()): string {
  const { y, m, d } = manilaParts(from);
  const targetMonth = d <= dueDay ? m : m + 1;
  return dayStart(y, targetMonth, dueDay);
}

// Date.UTC normalizes out-of-range day numbers (e.g. week spilling into the
// previous/next month), so the arithmetic below is safe without guards.
export function periodRangeIso(period: Period, date: Date = new Date()): { from: string; to: string } {
  const { y, m, d } = manilaParts(date);
  switch (period) {
    case 'day':
      return { from: dayStart(y, m, d), to: dayEnd(y, m, d) };
    case 'week': {
      const dow = new Date(Date.UTC(y, m, d)).getUTCDay(); // 0=Sun..6=Sat
      const mondayOffset = (dow + 6) % 7;
      return {
        from: dayStart(y, m, d - mondayOffset),
        to: dayEnd(y, m, d - mondayOffset + 6),
      };
    }
    case 'year':
      return { from: dayStart(y, 0, 1), to: dayEnd(y, 11, 31) };
    case 'month':
    default:
      return { from: dayStart(y, m, 1), to: dayEnd(y, m + 1, 0) };
  }
}
