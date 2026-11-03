import type { Category } from '../domain/types';

type TxType = 'Expense' | 'Income';
type CategoryLike = Pick<Category, 'id' | 'name' | 'type'>;

export type VoiceTransaction = {
  amount: number | null;
  type: TxType;
  categoryId: string | null;
  note: string;
};

const INCOME_WORDS = /\b(income|received?|earned|got paid|salary|sweldo|allowance)\b/i;

// Spoken words → default category names. Only used when the transcript doesn't name a category directly.
// ponytail: fixed keyword list, move to per-category keywords in the DB if users ask to customise it.
const CATEGORY_HINTS: Record<string, string[]> = {
  Food: ['coffee', 'breakfast', 'lunch', 'dinner', 'snack', 'meal', 'food', 'milk tea', 'drinks?'],
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

export function parseVoiceTransaction(text: string, categories: CategoryLike[], forceType?: TxType): VoiceTransaction {
  const amountMatch = text.match(AMOUNT);
  let amount: number | null = null;
  if (amountMatch) {
    amount = Number(amountMatch[1].replace(/,/g, ''));
    if (/k\b/i.test(amountMatch[0])) amount *= 1000;
    if (!(amount > 0)) amount = null;
  }

  const type: TxType = forceType ?? (INCOME_WORDS.test(text) ? 'Income' : 'Expense');
  const ofType = categories.filter((c) => c.type === type);
  const lower = text.toLowerCase();
  const hasWord = (pattern: string) => new RegExp(`\\b${pattern}\\b`, 'i').test(lower);

  // Longest name first so "Other Income" beats "Other".
  const named = [...ofType]
    .sort((a, b) => b.name.length - a.name.length)
    .find((c) => hasWord(c.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const hinted = named ?? ofType.find((c) => CATEGORY_HINTS[c.name]?.some(hasWord));

  let note = text;
  for (const f of FILLER) note = note.replace(f, ' ');
  // A connector left dangling once the amount is cut out: "spent 50 on grab" → "on grab".
  note = note.replace(/\s+/g, ' ').trim().replace(/^(on|for|at|of|a|an)\b\s*/i, '');
  note = note.charAt(0).toUpperCase() + note.slice(1);

  return { amount, type, categoryId: hinted?.id ?? null, note };
}
