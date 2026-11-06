export interface ParsedItem { name: string; qty: number; price: number; }
export interface ParsedReceipt { total: number | null; date: string | null; merchant: string; items: ParsedItem[]; }

// Amount at the end of a line: 1,234.50 or 45.00 (optionally prefixed with P / PHP / ₱).
const PRICE_END = /(?:₱|PHP|P)?\s*(\d{1,3}(?:,\d{3})*|\d+)[.,](\d{2})\s*[A-Z]?$/i;
const TOTAL_LINE = /\b(grand\s*total|amount\s*due|total\s*due|total)\b/i;
const SKIP_LINE = /\b(sub\s*-?\s*total|tax|vat|vatable|change|cash|card|tender|discount|service\s*charge|balance|tip)\b/i;
const QTY_PREFIX = /^(\d{1,3})\s*[x×@]\s*/i;

function amountOf(line: string): number | null {
  const m = line.match(PRICE_END);
  if (!m) return null;
  return parseFloat(`${m[1].replace(/,/g, '')}.${m[2]}`);
}

function parseDate(lines: string[]): string | null {
  for (const line of lines) {
    // 2026-11-03 or 2026/11/03
    let m = line.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    let y: number, mo: number, d: number;
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else {
      // 03/11/2026 — Philippine receipts are day-first
      m = line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/);
      if (!m) continue;
      d = +m[1]; mo = +m[2]; y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    // 04:00 UTC is noon in Manila, so the calendar day survives timezone display.
    return new Date(Date.UTC(y, mo - 1, d, 4)).toISOString();
  }
  return null;
}

/** Turn OCR text lines into form-ready fields. Never throws; unparsed fields come back empty. */
export function parseReceipt(lines: string[]): ParsedReceipt {
  const clean = lines.map((l) => l.trim()).filter(Boolean);

  let total: number | null = null;
  const amounts: number[] = [];
  const items: ParsedItem[] = [];

  clean.forEach((line, i) => {
    const amt = amountOf(line);
    if (amt == null) return;
    amounts.push(amt);
    if (TOTAL_LINE.test(line) && !/sub\s*-?\s*total/i.test(line)) {
      total = total == null ? amt : Math.max(total, amt);
      return;
    }
    if (SKIP_LINE.test(line)) return;
    let name = line.replace(PRICE_END, '').trim();
    let qty = 1;
    const q = name.match(QTY_PREFIX);
    if (q) { qty = +q[1]; name = name.slice(q[0].length).trim(); }
    // A name made only of digits/punctuation is a stray number (phone, date), not an item.
    if (!/[A-Za-z]{2}/.test(name) || i === 0) return;
    // The line's amount is its total; items store a unit price.
    items.push({ name, qty, price: Math.round((amt / (qty || 1)) * 100) / 100 });
  });

  if (total == null && amounts.length > 0) total = Math.max(...amounts);

  const merchant = clean.find((l) => /[A-Za-z]{3}/.test(l) && amountOf(l) == null) ?? '';
  return { total, date: parseDate(clean), merchant, items };
}
