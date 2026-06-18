import type * as SQLite from 'expo-sqlite';
import { SCHEMA_V1 } from './schema';
import { nowIso } from '../utils/date';
import { newId } from '../utils/id';
import { FIXED_USER_ID } from '../constants/user';

interface Migration {
  name: string;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    name: '001_initial_schema',
    up: async (db) => { await db.execAsync(SCHEMA_V1); },
  },
  {
    name: '002_seed_default_categories',
    up: async (db) => {
      const now = nowIso();
      const defaults: Array<{ name: string; type: 'Expense' | 'Income'; icon: string; color: string }> = [
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
      for (const c of defaults) {
        await db.runAsync(
          `INSERT INTO categories (id, userId, name, type, icon, color, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
          [newId(), FIXED_USER_ID, c.name, c.type, c.icon, c.color, now, now],
        );
      }
    },
  },
  {
    name: '003_seed_default_account',
    up: async (db) => {
      const now = nowIso();
      await db.runAsync(
        `INSERT INTO accounts (id, userId, name, type, initialBalance, currentBalance, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
         VALUES (?, ?, 'Cash', 'Cash', 0, 0, ?, ?, NULL, 1, NULL)`,
        [newId(), FIXED_USER_ID, now, now],
      );
    },
  },
  {
    name: '004_settings_table',
    up: async (db) => {
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
      );
    },
  },
];

export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, appliedAt TEXT NOT NULL
    );
  `);
  const applied = await db.getAllAsync<{ name: string }>(`SELECT name FROM _migrations`);
  const appliedNames = new Set(applied.map((r) => r.name));
  for (const m of MIGRATIONS) {
    if (appliedNames.has(m.name)) continue;
    await db.withTransactionAsync(async () => {
      await m.up(db);
      await db.runAsync(`INSERT INTO _migrations (name, appliedAt) VALUES (?, ?)`, [m.name, nowIso()]);
    });
  }
}
