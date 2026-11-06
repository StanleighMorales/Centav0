import type * as SQLite from 'expo-sqlite';
import { nowIso } from '../utils/date';
import { newId } from '../utils/id';
import { FIXED_USER_ID } from '../constants/user';

// What a fresh install starts with. Migrations seed these once and never run again,
// so Remove all data puts them back from here.
const DEFAULT_CATEGORIES: Array<{ name: string; type: 'Expense' | 'Income'; icon: string; color: string }> = [
  { name: 'Food',          type: 'Expense', icon: 'coffee',          color: '#ef4444' },
  { name: 'Transport',     type: 'Expense', icon: 'navigation',      color: '#f97316' },
  { name: 'Bills',         type: 'Expense', icon: 'file-text',       color: '#eab308' },
  { name: 'Groceries',     type: 'Expense', icon: 'shopping-bag',    color: '#22c55e' },
  { name: 'Shopping',      type: 'Expense', icon: 'tag',             color: '#06b6d4' },
  { name: 'Entertainment', type: 'Expense', icon: 'film',            color: '#8b5cf6' },
  { name: 'Health',        type: 'Expense', icon: 'heart',           color: '#ec4899' },
  { name: 'Other',         type: 'Expense', icon: 'more-horizontal', color: '#64748b' },
  { name: 'Salary',        type: 'Income',  icon: 'briefcase',       color: '#10b981' },
  { name: 'Gift',          type: 'Income',  icon: 'gift',            color: '#f59e0b' },
  { name: 'Other Income',  type: 'Income',  icon: 'trending-up',     color: '#0ea5e9' },
];

const DEFAULT_ACCOUNT_TYPES: Array<{ name: string; allowsOverdraft: boolean; isSavings: boolean }> = [
  { name: 'Cash',        allowsOverdraft: false, isSavings: false },
  { name: 'Bank',        allowsOverdraft: false, isSavings: false },
  { name: 'E-Wallet',    allowsOverdraft: false, isSavings: false },
  { name: 'Credit Card', allowsOverdraft: true,  isSavings: false },
  { name: 'Other',       allowsOverdraft: false, isSavings: false },
  { name: 'Savings',     allowsOverdraft: false, isSavings: true },
];

export async function seedDefaults(db: SQLite.SQLiteDatabase): Promise<void> {
  const now = nowIso();
  for (const c of DEFAULT_CATEGORIES) {
    await db.runAsync(
      `INSERT INTO categories (id, userId, name, type, icon, color, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
      [newId(), FIXED_USER_ID, c.name, c.type, c.icon, c.color, now, now],
    );
  }
  for (const t of DEFAULT_ACCOUNT_TYPES) {
    await db.runAsync(
      `INSERT INTO account_types (id, userId, name, allowsOverdraft, isSavings, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
      [newId(), FIXED_USER_ID, t.name, t.allowsOverdraft ? 1 : 0, t.isSavings ? 1 : 0, now, now],
    );
  }
}
