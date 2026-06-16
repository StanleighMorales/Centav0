export const SCHEMA_V1 = /* sql */ `
  CREATE TABLE IF NOT EXISTS accounts (
    id              TEXT PRIMARY KEY NOT NULL,
    userId          TEXT NOT NULL,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('Cash','Bank','EWallet','Other')),
    initialBalance  REAL NOT NULL DEFAULT 0,
    currentBalance  REAL NOT NULL DEFAULT 0,
    createdAt       TEXT NOT NULL,
    updatedAt       TEXT NOT NULL,
    deletedAt       TEXT,
    isDirty         INTEGER NOT NULL DEFAULT 1,
    syncedAt        TEXT
  );

  CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY NOT NULL,
    userId      TEXT NOT NULL,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('Expense','Income')),
    icon        TEXT,
    color       TEXT,
    createdAt   TEXT NOT NULL,
    updatedAt   TEXT NOT NULL,
    deletedAt   TEXT,
    isDirty     INTEGER NOT NULL DEFAULT 1,
    syncedAt    TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id           TEXT PRIMARY KEY NOT NULL,
    userId       TEXT NOT NULL,
    date         TEXT NOT NULL,
    amount       REAL NOT NULL,
    type         TEXT NOT NULL CHECK (type IN ('Expense','Income')),
    categoryId   TEXT NOT NULL,
    accountId    TEXT NOT NULL,
    note         TEXT,
    createdAt    TEXT NOT NULL,
    updatedAt    TEXT NOT NULL,
    deletedAt    TEXT,
    isDirty      INTEGER NOT NULL DEFAULT 1,
    syncedAt     TEXT,
    FOREIGN KEY (categoryId) REFERENCES categories(id),
    FOREIGN KEY (accountId)  REFERENCES accounts(id)
  );

  CREATE INDEX IF NOT EXISTS idx_tx_date        ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_tx_category    ON transactions(categoryId);
  CREATE INDEX IF NOT EXISTS idx_tx_account     ON transactions(accountId);
  CREATE INDEX IF NOT EXISTS idx_tx_not_deleted ON transactions(deletedAt) WHERE deletedAt IS NULL;

  CREATE TABLE IF NOT EXISTS debts (
    id                  TEXT PRIMARY KEY NOT NULL,
    userId              TEXT NOT NULL,
    creditor            TEXT NOT NULL,
    originalAmount      REAL NOT NULL,
    outstandingBalance  REAL NOT NULL,
    dueDate             TEXT,
    status              TEXT NOT NULL CHECK (status IN ('Open','Paid','Overdue')),
    interestRate        REAL,
    note                TEXT,
    createdAt           TEXT NOT NULL,
    updatedAt           TEXT NOT NULL,
    deletedAt           TEXT,
    isDirty             INTEGER NOT NULL DEFAULT 1,
    syncedAt            TEXT
  );

  CREATE TABLE IF NOT EXISTS debt_payments (
    id           TEXT PRIMARY KEY NOT NULL,
    userId       TEXT NOT NULL,
    debtId       TEXT NOT NULL,
    date         TEXT NOT NULL,
    amount       REAL NOT NULL,
    accountId    TEXT NOT NULL,
    createdAt    TEXT NOT NULL,
    updatedAt    TEXT NOT NULL,
    deletedAt    TEXT,
    isDirty      INTEGER NOT NULL DEFAULT 1,
    syncedAt     TEXT,
    FOREIGN KEY (debtId)    REFERENCES debts(id),
    FOREIGN KEY (accountId) REFERENCES accounts(id)
  );

  CREATE INDEX IF NOT EXISTS idx_dp_debt ON debt_payments(debtId);
  CREATE INDEX IF NOT EXISTS idx_dp_date ON debt_payments(date);

  CREATE TABLE IF NOT EXISTS allocations (
    id           TEXT PRIMARY KEY NOT NULL,
    userId       TEXT NOT NULL,
    categoryId   TEXT,
    accountId    TEXT,
    amount       REAL NOT NULL,
    period       TEXT NOT NULL CHECK (period IN ('Weekly','Monthly')),
    startDate    TEXT NOT NULL,
    createdAt    TEXT NOT NULL,
    updatedAt    TEXT NOT NULL,
    deletedAt    TEXT,
    isDirty      INTEGER NOT NULL DEFAULT 1,
    syncedAt     TEXT,
    FOREIGN KEY (categoryId) REFERENCES categories(id),
    FOREIGN KEY (accountId)  REFERENCES accounts(id),
    CHECK (
      (categoryId IS NOT NULL AND accountId IS NULL) OR
      (categoryId IS NULL AND accountId IS NOT NULL)
    )
  );

  CREATE TABLE IF NOT EXISTS _migrations (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    appliedAt  TEXT NOT NULL
  );
`;
