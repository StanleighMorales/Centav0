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
  {
    name: '005_transaction_receipt',
    up: async (db) => {
      await db.execAsync(`ALTER TABLE transactions ADD COLUMN receiptUri TEXT;`);
    },
  },
  {
    name: '006_installments_and_credit_cards',
    up: async (db) => {
      await db.execAsync(`
        ALTER TABLE debts ADD COLUMN isInstallment INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE debts ADD COLUMN monthlyPayment REAL;
        ALTER TABLE debts ADD COLUMN installmentFee REAL;
      `);
      // Rebuild accounts to widen the type CHECK for 'CreditCard' and add
      // credit card bill/due days. Runs with foreign_keys OFF (see database.ts):
      // references to `accounts` resolve by name after the rename.
      await db.execAsync(`
        CREATE TABLE accounts_new (
          id              TEXT PRIMARY KEY NOT NULL,
          userId          TEXT NOT NULL,
          name            TEXT NOT NULL,
          type            TEXT NOT NULL CHECK (type IN ('Cash','Bank','EWallet','CreditCard','Other')),
          initialBalance  REAL NOT NULL DEFAULT 0,
          currentBalance  REAL NOT NULL DEFAULT 0,
          billDay         INTEGER,
          dueDay          INTEGER,
          createdAt       TEXT NOT NULL,
          updatedAt       TEXT NOT NULL,
          deletedAt       TEXT,
          isDirty         INTEGER NOT NULL DEFAULT 1,
          syncedAt        TEXT
        );
        INSERT INTO accounts_new (id, userId, name, type, initialBalance, currentBalance, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
          SELECT id, userId, name, type, initialBalance, currentBalance, createdAt, updatedAt, deletedAt, isDirty, syncedAt FROM accounts;
        DROP TABLE accounts;
        ALTER TABLE accounts_new RENAME TO accounts;
      `);
    },
  },
  {
    name: '007_transfers',
    up: async (db) => {
      // Rebuild transactions to: widen type CHECK to include 'Transfer',
      // make categoryId nullable (transfers have no category), and add
      // toAccountId (destination account, Transfer rows only).
      // Runs with foreign_keys OFF, same as migration 006.
      await db.execAsync(`
        CREATE TABLE transactions_new (
          id           TEXT PRIMARY KEY NOT NULL,
          userId       TEXT NOT NULL,
          date         TEXT NOT NULL,
          amount       REAL NOT NULL,
          type         TEXT NOT NULL CHECK (type IN ('Expense','Income','Transfer')),
          categoryId   TEXT,
          accountId    TEXT NOT NULL,
          toAccountId  TEXT,
          note         TEXT,
          receiptUri   TEXT,
          createdAt    TEXT NOT NULL,
          updatedAt    TEXT NOT NULL,
          deletedAt    TEXT,
          isDirty      INTEGER NOT NULL DEFAULT 1,
          syncedAt     TEXT,
          FOREIGN KEY (categoryId)  REFERENCES categories(id),
          FOREIGN KEY (accountId)   REFERENCES accounts(id),
          FOREIGN KEY (toAccountId) REFERENCES accounts(id)
        );
        INSERT INTO transactions_new (id, userId, date, amount, type, categoryId, accountId, toAccountId, note, receiptUri, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
          SELECT id, userId, date, amount, type, categoryId, accountId, NULL, note, receiptUri, createdAt, updatedAt, deletedAt, isDirty, syncedAt FROM transactions;
        DROP TABLE transactions;
        ALTER TABLE transactions_new RENAME TO transactions;

        CREATE INDEX IF NOT EXISTS idx_tx_date        ON transactions(date);
        CREATE INDEX IF NOT EXISTS idx_tx_category    ON transactions(categoryId);
        CREATE INDEX IF NOT EXISTS idx_tx_account     ON transactions(accountId);
        CREATE INDEX IF NOT EXISTS idx_tx_to_account  ON transactions(toAccountId);
        CREATE INDEX IF NOT EXISTS idx_tx_not_deleted ON transactions(deletedAt) WHERE deletedAt IS NULL;
      `);
    },
  },
  {
    name: '008_lending',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS lending_people (
          id          TEXT PRIMARY KEY NOT NULL,
          userId      TEXT NOT NULL,
          name        TEXT NOT NULL,
          createdAt   TEXT NOT NULL,
          updatedAt   TEXT NOT NULL,
          deletedAt   TEXT,
          isDirty     INTEGER NOT NULL DEFAULT 1,
          syncedAt    TEXT
        );

        CREATE TABLE IF NOT EXISTS lendings (
          id                  TEXT PRIMARY KEY NOT NULL,
          userId              TEXT NOT NULL,
          personId            TEXT NOT NULL,
          amount              REAL NOT NULL,
          outstandingBalance  REAL NOT NULL,
          accountId           TEXT NOT NULL,
          date                TEXT NOT NULL,
          note                TEXT,
          status              TEXT NOT NULL CHECK (status IN ('Active','Paid')),
          createdAt           TEXT NOT NULL,
          updatedAt           TEXT NOT NULL,
          deletedAt           TEXT,
          isDirty             INTEGER NOT NULL DEFAULT 1,
          syncedAt            TEXT,
          FOREIGN KEY (personId)  REFERENCES lending_people(id),
          FOREIGN KEY (accountId) REFERENCES accounts(id)
        );
        CREATE INDEX IF NOT EXISTS idx_lending_person ON lendings(personId);

        CREATE TABLE IF NOT EXISTS lending_payments (
          id           TEXT PRIMARY KEY NOT NULL,
          userId       TEXT NOT NULL,
          lendingId    TEXT NOT NULL,
          date         TEXT NOT NULL,
          amount       REAL NOT NULL,
          accountId    TEXT NOT NULL,
          createdAt    TEXT NOT NULL,
          updatedAt    TEXT NOT NULL,
          deletedAt    TEXT,
          isDirty      INTEGER NOT NULL DEFAULT 1,
          syncedAt     TEXT,
          FOREIGN KEY (lendingId) REFERENCES lendings(id),
          FOREIGN KEY (accountId) REFERENCES accounts(id)
        );
        CREATE INDEX IF NOT EXISTS idx_lp_lending ON lending_payments(lendingId);
        CREATE INDEX IF NOT EXISTS idx_lp_date    ON lending_payments(date);
      `);
    },
  },
  {
    name: '009_debt_type',
    up: async (db) => {
      await db.execAsync(`
        ALTER TABLE debts ADD COLUMN debtType TEXT NOT NULL DEFAULT 'Custom';
        ALTER TABLE debts ADD COLUMN disbursementAccountId TEXT;
      `);
    },
  },
  {
    name: '010_account_types',
    up: async (db) => {
      const now = nowIso();
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS account_types (
          id              TEXT PRIMARY KEY NOT NULL,
          userId          TEXT NOT NULL,
          name            TEXT NOT NULL,
          allowsOverdraft INTEGER NOT NULL DEFAULT 0,
          createdAt       TEXT NOT NULL,
          updatedAt       TEXT NOT NULL,
          deletedAt       TEXT,
          isDirty         INTEGER NOT NULL DEFAULT 1,
          syncedAt        TEXT
        );
      `);
      const seeds: Array<{ legacyType: string; name: string; allowsOverdraft: boolean }> = [
        { legacyType: 'Cash', name: 'Cash', allowsOverdraft: false },
        { legacyType: 'Bank', name: 'Bank', allowsOverdraft: false },
        { legacyType: 'EWallet', name: 'E-Wallet', allowsOverdraft: false },
        { legacyType: 'CreditCard', name: 'Credit Card', allowsOverdraft: true },
        { legacyType: 'Other', name: 'Other', allowsOverdraft: false },
      ];
      const idByLegacyType: Record<string, string> = {};
      for (const s of seeds) {
        const id = newId();
        idByLegacyType[s.legacyType] = id;
        await db.runAsync(
          `INSERT INTO account_types (id, userId, name, allowsOverdraft, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
           VALUES (?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
          [id, FIXED_USER_ID, s.name, s.allowsOverdraft ? 1 : 0, now, now],
        );
      }
      // Rebuild accounts to replace the fixed `type` CHECK with a FK to
      // account_types, denormalizing allowsOverdraft for the many raw-SQL
      // call sites that branch on it without joining.
      await db.execAsync(`
        CREATE TABLE accounts_new (
          id              TEXT PRIMARY KEY NOT NULL,
          userId          TEXT NOT NULL,
          name            TEXT NOT NULL,
          accountTypeId   TEXT NOT NULL REFERENCES account_types(id),
          allowsOverdraft INTEGER NOT NULL DEFAULT 0,
          initialBalance  REAL NOT NULL DEFAULT 0,
          currentBalance  REAL NOT NULL DEFAULT 0,
          billDay         INTEGER,
          dueDay          INTEGER,
          createdAt       TEXT NOT NULL,
          updatedAt       TEXT NOT NULL,
          deletedAt       TEXT,
          isDirty         INTEGER NOT NULL DEFAULT 1,
          syncedAt        TEXT
        );
      `);
      await db.runAsync(
        `INSERT INTO accounts_new (id, userId, name, accountTypeId, allowsOverdraft, initialBalance, currentBalance, billDay, dueDay, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
         SELECT id, userId, name,
           CASE type
             WHEN 'Cash' THEN ? WHEN 'Bank' THEN ? WHEN 'EWallet' THEN ? WHEN 'CreditCard' THEN ? ELSE ?
           END,
           CASE WHEN type = 'CreditCard' THEN 1 ELSE 0 END,
           initialBalance, currentBalance, billDay, dueDay, createdAt, updatedAt, deletedAt, isDirty, syncedAt
         FROM accounts`,
        [
          idByLegacyType.Cash, idByLegacyType.Bank, idByLegacyType.EWallet,
          idByLegacyType.CreditCard, idByLegacyType.Other,
        ],
      );
      await db.execAsync(`
        DROP TABLE accounts;
        ALTER TABLE accounts_new RENAME TO accounts;
      `);
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
