import type { Account, Category, Debt } from '../domain/types';

type TxType = 'Expense' | 'Income';
type CategoryLike = Pick<Category, 'id' | 'name' | 'type'>;
type AccountLike = Pick<Account, 'id' | 'name'>;

export type VoiceTransaction = {
  amount: number | null;
  type: TxType;
  categoryId: string | null;
  accountId: string | null;
  note: string;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const longestFirst = <T extends { name: string }>(xs: T[]) => [...xs].sort((a, b) => b.name.length - a.name.length);

const INCOME_WORDS = /\b(income|received?|earned|got paid|salary|sweldo|allowance)\b/i;

// Spoken words → default category names. Only used when the transcript doesn't name a category directly.
// ponytail: fixed keyword list, move to per-category keywords in the DB if users ask to customise it.
const CATEGORY_HINTS: Record<string, string[]> = {
  Food: [
    'coffee', 'breakfast', 'lunch', 'dinner', 'snacks?', 'meals?', 'food', 'merienda', 'milk ?tea', 'drinks?',
    'juice', 'tea', 'soda', 'softdrinks?', 'coke', 'beer', 'bread', 'pandesal', 'cake', 'donuts?', 'ice cream',
    'pizza', 'burgers?', 'fries', 'rice', 'chicken', 'pork', 'fish', 'noodles', 'pasta', 'siomai', 'kwek ?kwek',
    'fishball', 'halo ?halo', 'jollibee', 'mcdo', 'mcdonalds?', 'kfc', 'starbucks', 'chowking', 'mang inasal',
  ],
  Transport: ['grab', 'taxi', 'jeep(ney)?', 'bus', 'fare', 'gas', 'fuel', 'mrt', 'lrt', 'tricycle', 'parking', 'toll'],
  Bills: ['bills?', 'electric(ity)?', 'water', 'internet', 'wifi', 'rent', 'load', 'phone'],
  Groceries: ['groceries', 'grocery', 'market', 'palengke', 'supermarket'],
  Shopping: ['clothes', 'shoes', 'shopee', 'lazada'],
  Entertainment: ['movies?', 'netflix', 'spotify', 'games?', 'concert'],
  Health: ['medicine', 'doctor', 'pharmacy', 'vitamins', 'checkup', 'dentist'],
  Salary: ['salary', 'sweldo', 'payroll'],
  Gift: ['gift', 'regalo'],
};

const AMOUNT = /(?:₱|php|p)?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:k\b)?/i;

// Words that frame the sentence but aren't part of the note: "add … worth 20 pesos as an expense".
const FILLER = [
  /^\s*(please\s+)?(add|log|record|spent|spend|paid|pay|bought|buy|received?|got|earned)\b(\s+(a|an|my|for|on))?/i,
  /\b(worth|for|of|cost(ing)?|amounting to|at|na)?\s*(₱|php|p)?\s*\d[\d,]*(\.\d+)?\s*k?\s*(pesos?|php|centavos)?\b/gi,
  /\b(as|for)\s+(an?\s+)?(expense|income)\b/gi,
  /\b(expense|income)\b/gi,
];

function parseAmount(text: string): number | null {
  const m = text.match(AMOUNT);
  if (!m) return null;
  const amount = Number(m[1].replace(/,/g, '')) * (/k\b/i.test(m[0]) ? 1000 : 1);
  return amount > 0 ? amount : null;
}

export function parseVoiceTransaction(
  text: string,
  categories: CategoryLike[],
  forceType?: TxType,
  accounts: AccountLike[] = [],
): VoiceTransaction {
  const amount = parseAmount(text);
  const type: TxType = forceType ?? (INCOME_WORDS.test(text) ? 'Income' : 'Expense');
  const ofType = categories.filter((c) => c.type === type);
  const lower = text.toLowerCase();
  const hasWord = (pattern: string) => new RegExp(`\\b${pattern}\\b`, 'i').test(lower);

  // Longest name first so "Other Income" beats "Other".
  const named = longestFirst(ofType).find((c) => hasWord(escapeRe(c.name.toLowerCase())));
  const hinted = named ?? ofType.find((c) => CATEGORY_HINTS[c.name]?.some(hasWord));
  const account = longestFirst(accounts).find((a) => hasWord(escapeRe(a.name.toLowerCase())));

  let note = text;
  // "… using my GCash account" says where the money came from, not what it was for.
  if (account) {
    note = note.replace(
      new RegExp(`\\b((from|using|via|with|through|thru|on|in|to|into)\\s+)?(my\\s+)?${escapeRe(account.name)}(\\s+(account|wallet))?\\b`, 'i'),
      ' ',
    );
  }
  for (const f of FILLER) note = note.replace(f, ' ');
  // A connector left dangling once the amount is cut out: "spent 50 on grab" → "on grab".
  note = note.replace(/\s+/g, ' ').trim().replace(/^(on|for|at|of|a|an)\b\s*/i, '');
  note = note.charAt(0).toUpperCase() + note.slice(1);

  return { amount, type, categoryId: hinted?.id ?? null, accountId: account?.id ?? null, note };
}

export type VoiceCommand =
  | { kind: 'transfer'; fromId: string | null; toId: string | null; amount: number | null }
  | { kind: 'pay'; debtId: string | null; accountId: string | null; amount: number | null }
  | { kind: 'transaction' };

type BalanceAccount = AccountLike & Pick<Account, 'currentBalance'>;
type DebtLike = Pick<Debt, 'id' | 'creditor' | 'status'>;

const TRANSFER_START = /^\s*(please\s+)?(transfer|move|send)\b/i;
const PAY_START = /^\s*(please\s+)?pay\b/i;
// "pay 200 for parking" is an expense; only treat "pay …" as a debt payment when it names a debt or sounds like one.
const DEBT_WORDS = /\b(balance|loan|debt|card|installment|statement|dues?)\b/i;
const ALL_WORDS = /\b(all|everything|whole|entire)\b/i;

// First item named in `text`, optionally right after `lead` ("to my GCash"); also returns the text with that phrase cut out.
function take<T>(text: string, items: T[], name: (x: T) => string, lead = ''): { hit: T | null; rest: string } {
  if (items.length === 0) return { hit: null, rest: text };
  // Longest first so "BPI Savings" wins over "BPI" at the same spot.
  const sorted = [...items].sort((a, b) => name(b).length - name(a).length);
  const m = new RegExp(`${lead}\\b(${sorted.map((x) => escapeRe(name(x))).join('|')})\\b`, 'i').exec(text);
  if (!m) return { hit: null, rest: text };
  const hit = sorted.find((x) => name(x).toLowerCase() === m[1].toLowerCase()) ?? null;
  return { hit, rest: `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}` };
}

const accountName = (a: AccountLike) => a.name;
const TO = String.raw`\b(?:to|into)\s+(?:my\s+)?`;
const FROM = String.raw`\bfrom\s+(?:my\s+)?`;
const SOURCE = String.raw`\b(?:with|using|from|via|through|thru)\s+(?:my\s+)?`;

/** Spoken transfers and debt payments. Anything else is `transaction`; parse it with parseVoiceTransaction. */
export function parseVoiceCommand(text: string, accounts: BalanceAccount[], debts: DebtLike[]): VoiceCommand {
  if (TRANSFER_START.test(text)) {
    let to = take(text, accounts, accountName, TO);
    let from = take(to.rest, accounts, accountName, FROM);
    // No "to"/"from": "transfer cash gcash 500" reads left to right.
    if (!from.hit) from = take(to.rest, accounts, accountName);
    if (!to.hit) to = take(from.rest, accounts, accountName);
    // "all" from an account that owes (credit card) has nothing to move.
    const all = from.hit && from.hit.currentBalance > 0 ? from.hit.currentBalance : null;
    const amount = ALL_WORDS.test(text) ? all : parseAmount(text);
    return { kind: 'transfer', fromId: from.hit?.id ?? null, toId: to.hit?.id ?? null, amount };
  }

  if (PAY_START.test(text)) {
    // Cut the source account out first, so a card that is also an account ("MariBank") is read as the debt.
    const source = take(text, accounts, accountName, SOURCE);
    const open = debts.filter((d) => d.status !== 'Paid');
    const debt = take(source.rest, open, (d) => d.creditor);
    if (debt.hit || DEBT_WORDS.test(text)) {
      return { kind: 'pay', debtId: debt.hit?.id ?? null, accountId: source.hit?.id ?? null, amount: parseAmount(text) };
    }
  }

  return { kind: 'transaction' };
}
