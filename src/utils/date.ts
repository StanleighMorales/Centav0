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

export function startOfDayManilaIso(date: Date = new Date()): string {
  const manila = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  manila.setHours(0, 0, 0, 0);
  return new Date(manila.getTime() - 8 * 60 * 60 * 1000).toISOString();
}

export function endOfDayManilaIso(date: Date = new Date()): string {
  const manila = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  manila.setHours(23, 59, 59, 999);
  return new Date(manila.getTime() - 8 * 60 * 60 * 1000).toISOString();
}
