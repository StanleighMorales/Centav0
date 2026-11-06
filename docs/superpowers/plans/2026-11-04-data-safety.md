# Data Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backups carry receipt photos and contract PDFs, the app reminds you to back up, recurring bills that can't post say so, and "Remove all data" really removes everything.

**Architecture:** Attachments travel as BLOBs in a table that only exists inside the backup `.db`, so there's still one file and no new dependency. Pure rules live in `src/utils/backupRules.ts` with a `.check.mts` self-check. The dashboard runs the recurring pass at the start of `load()` and shows both warnings through one `NoticeCard`.

**Tech Stack:** Expo SDK 57, expo-sqlite, expo-file-system (`File`, `Directory`, `Paths`), expo-sharing, TypeScript. No test framework: pure logic is checked by `node --experimental-strip-types src/utils/<name>.check.mts`.

**Spec:** `docs/superpowers/specs/2026-11-04-data-safety-design.md`

---

## Ground rules

- **Commit messages carry no AI attribution:** no `Co-Authored-By`, no `Claude-Session`. This is the user's global rule.
- **Stage only the files each task names.** Never `git add -A` or `git add .`.
- **No migration.** Don't touch `src/db/migrations.ts`.
- **UI code uses theme tokens only.** No hardcoded colours or sizes.
- **Versioned docs:** per `AGENTS.md`, check https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/ and https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/ before Task 3. `bytes()`, `write()`, `create({ intermediates, overwrite })` and the `Uint8Array` bind type were confirmed against the installed `node_modules` types.

## Files

| File | Change |
|---|---|
| `src/utils/backupRules.ts` | Create. Pure rules: `attachmentDest`, `backupIsStale`, `backupAgeLabel`, constants |
| `src/utils/backupRules.check.mts` | Create. Self-check for the above |
| `src/db/database.ts` | Reset clears `transaction_items` and the attachment folders |
| `src/db/backup.ts` | Embed attachments on export, extract on restore, save `lastBackupAt` |
| `src/repositories/sqlite/SqliteTransactionRepository.ts` | Add `NotEnoughError`, identical to the hunk in `94717ad` |
| `src/db/recurring.ts` | Return stuck rules, share an in-flight run |
| `app/_layout.tsx` | Stop running the recurring pass at start |
| `app/settings/index.tsx` | Show reset errors, show last backup age, drop the PDF warning |
| `src/components/dashboard/NoticeCard.tsx` | Create. Tappable warning card |
| `app/(tabs)/index.tsx` | Run the recurring pass in `load()`, show both notices |

---

### Task 0: Branch

The branch is based on `origin/develop` and lives in its own checkout, so the uncommitted flat-rate loan work on `feat/credit-lines` stays untouched.

- [ ] **Step 1: Create the branch and checkout**

Run from the main checkout: `git worktree add --no-track -b fix/data-safety .claude/worktrees/data-safety origin/develop`

- [ ] **Step 2: Install and record the baseline**

Run: `npm ci`, then every `src/utils/*.check.mts`, then `npx tsc --noEmit`
Expected: all pass before any change

---

### Task 1: Pure backup rules

**Files:**
- Create: `src/utils/backupRules.ts`
- Test: `src/utils/backupRules.check.mts`

- [ ] **Step 1: Write the failing check**

Create `src/utils/backupRules.check.mts`:

```ts
// Self-check for backupRules.ts. Run directly:
//   node --experimental-strip-types src/utils/backupRules.check.mts
import assert from 'node:assert';
import { attachmentDest, backupAgeLabel, backupIsStale } from './backupRules.ts';

const DOCS = 'file:///data/user/0/com.stanleighmorales.centav0/files';
const CACHE = 'file:///data/user/0/com.stanleighmorales.centav0/cache';

assert.deepStrictEqual(
  attachmentDest(`${DOCS}/receipts/abc-123.jpg`),
  { folder: 'receipts', name: 'abc-123.jpg' },
  'current receipt',
);
assert.deepStrictEqual(
  attachmentDest(`${CACHE}/ImagePicker/abc-123.jpeg`),
  { folder: 'receipts', name: 'abc-123.jpeg' },
  'older receipt left in the picker cache',
);
assert.deepStrictEqual(
  attachmentDest(`${DOCS}/contracts/abc-123.pdf`),
  { folder: 'contracts', name: 'abc-123.pdf' },
  'contract',
);
assert.strictEqual(attachmentDest(`${DOCS}/receipts/..`), null, 'never a parent folder');
assert.strictEqual(attachmentDest(`${DOCS}/receipts/..%2F..%2Fx.jpg`), null, 'no encoded path tricks');
assert.strictEqual(attachmentDest(`${DOCS}/SQLite/centav0.db`), null, 'not a file type we attach');
assert.strictEqual(attachmentDest(''), null, 'nothing to go on');

const now = new Date('2026-11-20T04:00:00.000Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

assert.strictEqual(backupIsStale(daysAgo(13), null, now), false, 'backup still fresh at 13 days');
assert.strictEqual(backupIsStale(daysAgo(14), null, now), true, 'backup stale at 14 days');
assert.strictEqual(backupIsStale(null, daysAgo(13), now), false, 'a new user gets 14 days before the first nudge');
assert.strictEqual(backupIsStale(null, daysAgo(14), now), true, 'never backed up, clock runs from the oldest transaction');
assert.strictEqual(backupIsStale(daysAgo(1), daysAgo(100), now), false, 'a backup beats the oldest transaction');
assert.strictEqual(backupIsStale(null, null, now), false, 'an empty app has nothing to back up');

assert.strictEqual(backupAgeLabel(null, now), 'No backup yet');
assert.strictEqual(backupAgeLabel(daysAgo(0), now), 'Last backup: today');
assert.strictEqual(backupAgeLabel(daysAgo(1), now), 'Last backup: 1 day ago');
assert.strictEqual(backupAgeLabel(daysAgo(23), now), 'Last backup: 23 days ago');

console.log('backupRules.ts: all checks passed');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types src/utils/backupRules.check.mts`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `backupRules.ts`

- [ ] **Step 3: Write the rules**

Create `src/utils/backupRules.ts`. Keep it free of imports so the self-check can load it.

```ts
export const ATTACHMENT_FOLDERS = ['receipts', 'contracts'] as const;
export const LAST_BACKUP_KEY = 'lastBackupAt';

const BACKUP_STALE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where a file from a backup belongs under the documents folder, or null to skip it. Only the name is used:
 * backups come from outside the app, and receipts from before the scan feature sit in the picker's cache folder.
 */
export function attachmentDest(uri: string): { folder: (typeof ATTACHMENT_FOLDERS)[number]; name: string } | null {
  const name = uri.split('/').pop() ?? '';
  const match = /^[\w-]+\.(jpe?g|png|webp|heic|pdf)$/i.exec(name);
  if (!match) return null;
  return { folder: match[1].toLowerCase() === 'pdf' ? 'contracts' : 'receipts', name };
}

/** With no backup yet the clock starts at the oldest transaction, so a new user isn't nagged on day one. */
export function backupIsStale(
  lastBackupAt: string | null,
  oldestTransactionDate: string | null,
  now: Date = new Date(),
): boolean {
  const since = lastBackupAt ?? oldestTransactionDate;
  if (!since) return false;
  return now.getTime() - new Date(since).getTime() >= BACKUP_STALE_DAYS * DAY_MS;
}

export function backupAgeLabel(lastBackupAt: string | null, now: Date = new Date()): string {
  if (!lastBackupAt) return 'No backup yet';
  const days = Math.floor((now.getTime() - new Date(lastBackupAt).getTime()) / DAY_MS);
  if (days <= 0) return 'Last backup: today';
  return `Last backup: ${days} ${days === 1 ? 'day' : 'days'} ago`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --experimental-strip-types src/utils/backupRules.check.mts`
Expected: `backupRules.ts: all checks passed`

- [ ] **Step 5: Commit**

```bash
git add src/utils/backupRules.ts src/utils/backupRules.check.mts
git commit -m "feat(backup): add rules for attachment paths and backup age"
```

---

### Task 2: Make "Remove all data" work

**Files:**
- Modify: `src/db/database.ts`
- Modify: `app/settings/index.tsx`

- [ ] **Step 1: Add the imports to `src/db/database.ts`**

Replace:

```ts
import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';
```

with:

```ts
import * as SQLite from 'expo-sqlite';
import { Directory, Paths } from 'expo-file-system';
import { runMigrations } from './migrations';
import { ATTACHMENT_FOLDERS } from '../utils/backupRules';
```

- [ ] **Step 2: Add `transaction_items` ahead of `transactions`**

Its foreign key points at `transactions`, so it has to go first. Replace:

```ts
  'debt_payments', 'lending_payments', 'transactions', 'lendings',
```

with:

```ts
  'debt_payments', 'lending_payments', 'transaction_items', 'transactions', 'lendings',
```

- [ ] **Step 3: Delete the attachment folders after the rows**

Replace:

```ts
      await db.execAsync(`DELETE FROM ${table};`);
    }
  });
}
```

with:

```ts
      await db.execAsync(`DELETE FROM ${table};`);
    }
  });
  // After the rows: a failed reset must not leave links to files that are gone.
  for (const folder of ATTACHMENT_FOLDERS) {
    const dir = new Directory(Paths.document, folder);
    if (dir.exists) dir.delete();
  }
}
```

- [ ] **Step 4: Show reset failures in `app/settings/index.tsx`**

`closeReset()` runs in the catch because the error text sits behind the sheet. Replace:

```ts
      await resetAppData();
      closeReset();
      router.replace('/onboarding');
    } finally {
```

with:

```ts
      await resetAppData();
      closeReset();
      router.replace('/onboarding');
    } catch (e) {
      closeReset();
      setError(`Reset failed: ${String(e)}`);
    } finally {
```

- [ ] **Step 5: Say that files go too**

Replace:

```tsx
            This deletes every account, category, transaction, budget, debt, payment, and lending
            record. Back up first if you want to keep it. Type CONFIRM to continue.
```

with:

```tsx
            This deletes every account, category, transaction, budget, debt, payment, and lending
            record, plus receipt photos and contract PDFs. Back up first if you want to keep it.
            Type CONFIRM to continue.
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0

- [ ] **Step 7: Commit**

```bash
git add src/db/database.ts app/settings/index.tsx
git commit -m "fix(settings): remove all data clears receipt items and files"
```

---

### Task 3: Put attachments in the backup

**Files:**
- Modify: `src/db/backup.ts`
- Modify: `app/settings/index.tsx`

- [ ] **Step 1: Add the imports to `src/db/backup.ts`**

Replace:

```ts
import { runMigrations, SCHEMA_VERSION } from './migrations';
```

with:

```ts
import { runMigrations, SCHEMA_VERSION } from './migrations';
import { setSetting } from '../repositories';
import { attachmentDest, LAST_BACKUP_KEY } from '../utils/backupRules';
import { nowIso } from '../utils/date';
```

- [ ] **Step 2: Embed attachments on export**

Replace the doc comment and the whole of `exportBackup` with:

```ts
/** Copy every attached file into the snapshot, one at a time so memory peaks at a single file. */
async function embedAttachments(snapshotDb: SQLite.SQLiteDatabase): Promise<void> {
  await snapshotDb.execAsync(`CREATE TABLE _attachments (uri TEXT PRIMARY KEY, data BLOB NOT NULL);`);
  // Soft-deleted rows count, so a restored archive keeps its receipts.
  const rows = await snapshotDb.getAllAsync<{ uri: string }>(
    `SELECT receiptUri AS uri FROM transactions WHERE receiptUri IS NOT NULL
     UNION SELECT uri FROM investment_documents`,
  );
  for (const { uri } of rows) {
    const file = new File(uri);
    if (!file.exists) continue;
    await snapshotDb.runAsync(`INSERT INTO _attachments (uri, data) VALUES (?, ?)`, [uri, await file.bytes()]);
  }
  // The snapshot inherits WAL mode, and these rows must be in the .db file before it's shared.
  await snapshotDb.execAsync(`PRAGMA wal_checkpoint(TRUNCATE);`);
}

/**
 * Snapshot the live database via SQLite's own online-backup API (safe under WAL —
 * no raw file copy, so a write mid-export can't tear the file), add the attached
 * files, and hand it to the OS share sheet.
 */
export async function exportBackup(): Promise<void> {
  const db = await getDatabase();
  const name = backupFileName();
  const file = new File(Paths.cache, name);
  try {
    const snapshotDb = await SQLite.openDatabaseAsync(name, undefined, Paths.cache.uri);
    try {
      await SQLite.backupDatabaseAsync({
        sourceDatabase: db,
        sourceDatabaseName: 'main',
        destDatabase: snapshotDb,
        destDatabaseName: 'main',
      });
      await embedAttachments(snapshotDb);
    } finally {
      await snapshotDb.closeAsync();
    }
    await Sharing.shareAsync(file.uri, { dialogTitle: 'Save Centav0 backup' });
    // ponytail: shareAsync can't say if the file was saved, so a cancelled sheet counts as a backup.
    await setSetting(LAST_BACKUP_KEY, nowIso());
  } finally {
    if (file.exists) file.delete();
  }
}
```

- [ ] **Step 3: Add the extraction step**

Add this function directly above the `restoreBackup` doc comment:

```ts
/**
 * Write the backup's files to disk and point the staged rows at them, since the new phone's
 * storage path can differ. Drops the table so the live database never carries the blobs.
 */
async function extractAttachments(stagedDb: SQLite.SQLiteDatabase): Promise<void> {
  const table = await stagedDb.getFirstAsync(
    `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_attachments'`,
  );
  if (!table) return; // made before backups carried attachments
  const rows = await stagedDb.getAllAsync<{ uri: string }>(`SELECT uri FROM _attachments`);
  for (const { uri } of rows) {
    const dest = attachmentDest(uri);
    if (!dest) continue;
    const row = await stagedDb.getFirstAsync<{ data: Uint8Array }>(`SELECT data FROM _attachments WHERE uri = ?`, [uri]);
    if (!row) continue;
    const file = new File(Paths.document, dest.folder, dest.name);
    file.create({ intermediates: true, overwrite: true });
    file.write(row.data);
    await stagedDb.runAsync(`UPDATE transactions SET receiptUri = ? WHERE receiptUri = ?`, [file.uri, uri]);
    await stagedDb.runAsync(`UPDATE investment_documents SET uri = ? WHERE uri = ?`, [file.uri, uri]);
  }
  await stagedDb.execAsync(`DROP TABLE _attachments; VACUUM;`);
}

```

- [ ] **Step 4: Call it during restore**

Replace:

```ts
    const db = await getDatabase();
    await SQLite.backupDatabaseAsync({
      sourceDatabase: stagedDb,
      sourceDatabaseName: 'main',
      destDatabase: db,
      destDatabaseName: 'main',
    });
    await runMigrations(db);
    return 'restored';
```

with:

```ts
    await extractAttachments(stagedDb);

    const db = await getDatabase();
    await SQLite.backupDatabaseAsync({
      sourceDatabase: stagedDb,
      sourceDatabaseName: 'main',
      destDatabase: db,
      destDatabaseName: 'main',
    });
    await runMigrations(db);
    await setSetting(LAST_BACKUP_KEY, nowIso());
    return 'restored';
```

- [ ] **Step 5: Remove the outdated warning from `app/settings/index.tsx`**

Delete these lines:

```tsx
      <AppText variant="bodySm" color="textMuted" style={styles.error}>
        Backups include investment records but not their contract PDFs.
      </AppText>
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0

- [ ] **Step 7: Commit**

```bash
git add src/db/backup.ts app/settings/index.tsx
git commit -m "feat(backup): include receipt photos and contract PDFs"
```

---

### Task 4: Show the last backup in Settings

**Files:**
- Modify: `app/settings/index.tsx`

- [ ] **Step 1: Update the imports**

Replace:

```ts
import React, { useState } from 'react';
```

with:

```ts
import React, { useEffect, useState } from 'react';
```

Replace:

```ts
import { resetAppData } from '../../src/db/database';
```

with:

```ts
import { resetAppData } from '../../src/db/database';
import { getSetting } from '../../src/repositories';
import { backupAgeLabel, LAST_BACKUP_KEY } from '../../src/utils/backupRules';
```

- [ ] **Step 2: Give `Row` an optional hint**

Replace:

```ts
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

function Row({ icon, label, onPress, destructive }: RowProps) {
```

with:

```ts
  label: string;
  hint?: string;
  onPress: () => void;
  destructive?: boolean;
};

function Row({ icon, label, hint, onPress, destructive }: RowProps) {
```

Replace:

```tsx
      <AppText variant="body" color={destructive ? 'negative' : 'textPrimary'} style={styles.rowLabel}>
        {label}
      </AppText>
```

with:

```tsx
      <View style={styles.rowLabel}>
        <AppText variant="body" color={destructive ? 'negative' : 'textPrimary'}>{label}</AppText>
        {hint ? <AppText variant="bodySm" color="textMuted">{hint}</AppText> : null}
      </View>
```

- [ ] **Step 3: Load the value and refresh it after a backup**

Replace:

```ts
  const [error, setError] = useState<string | null>(null);

  async function handleBackup() {
```

with:

```ts
  const [error, setError] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  useEffect(() => { getSetting(LAST_BACKUP_KEY).then(setLastBackupAt); }, []);

  async function handleBackup() {
```

Replace:

```ts
      await exportBackup();
    } catch (e) {
```

with:

```ts
      await exportBackup();
      setLastBackupAt(await getSetting(LAST_BACKUP_KEY));
    } catch (e) {
```

- [ ] **Step 4: Show it on the row**

Replace:

```tsx
      <Row icon="upload" label="Back up now" onPress={handleBackup} />
```

with:

```tsx
      <Row icon="upload" label="Back up now" hint={backupAgeLabel(lastBackupAt)} onPress={handleBackup} />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0

- [ ] **Step 6: Commit**

```bash
git add app/settings/index.tsx
git commit -m "feat(settings): show how old the last backup is"
```

---

### Task 5: Dashboard backup reminder

**Files:**
- Create: `src/components/dashboard/NoticeCard.tsx`
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Create the card**

Create `src/components/dashboard/NoticeCard.tsx`:

```tsx
import React from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../ui/AppText';
import { theme, makeStyles, useTheme } from '../../theme';

type Props = {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  lines: string[];
  onPress: () => void;
};

export function NoticeCard({ icon, title, lines, onPress }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${lines.join('. ')}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Feather name={icon} size={18} color={colors.warning} />
      <View style={styles.text}>
        <AppText variant="labelLg">{title}</AppText>
        {lines.map((line, i) => (
          <AppText key={i} variant="bodySm" color="textSecondary">{line}</AppText>
        ))}
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    backgroundColor: c.warningBg,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
  },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: theme.spacing[1] },
}));
```

- [ ] **Step 2: Add the imports to `app/(tabs)/index.tsx`**

Replace:

```ts
import { AccountCarousel } from '../../src/components/dashboard/AccountCarousel';
```

with:

```ts
import { AccountCarousel } from '../../src/components/dashboard/AccountCarousel';
import { NoticeCard } from '../../src/components/dashboard/NoticeCard';
```

Replace:

```ts
import { onDataChanged } from '../../src/utils/dataEvents';
```

with:

```ts
import { onDataChanged } from '../../src/utils/dataEvents';
import { backupAgeLabel, backupIsStale, LAST_BACKUP_KEY } from '../../src/utils/backupRules';
```

- [ ] **Step 3: Add the state**

Replace:

```ts
  const [hideSavings, setHideSavings] = useState(false);
```

with:

```ts
  const [hideSavings, setHideSavings] = useState(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
```

- [ ] **Step 4: Work it out in `load()`**

`transactionRepo.list()` sorts newest first, so the last row is the oldest. Replace:

```ts
    setHideSavings((await getSetting(HIDE_SAVINGS_KEY)) === '1');
    setLoading(false);
```

with:

```ts
    setHideSavings((await getSetting(HIDE_SAVINGS_KEY)) === '1');
    const lastBackupAt = await getSetting(LAST_BACKUP_KEY);
    setBackupNotice(backupIsStale(lastBackupAt, txns[txns.length - 1]?.date ?? null) ? backupAgeLabel(lastBackupAt) : null);
    setLoading(false);
```

- [ ] **Step 5: Render it below the balance card**

Replace:

```tsx
          </LinearGradient>

          {savingsAccounts.length > 0 && (
```

with:

```tsx
          </LinearGradient>

          {backupNotice && (
            <NoticeCard icon="upload" title="Time to back up" lines={[backupNotice]} onPress={() => router.push('/settings')} />
          )}

          {savingsAccounts.length > 0 && (
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/NoticeCard.tsx "app/(tabs)/index.tsx"
git commit -m "feat(dashboard): remind to back up after 14 days"
```

---

### Task 6: Show recurring bills that didn't post

**Files:**
- Modify: `src/repositories/sqlite/SqliteTransactionRepository.ts`
- Modify: `src/db/recurring.ts`
- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 0: Add `NotEnoughError`**

`develop` doesn't have it yet: it arrives with `94717ad` on `feat/credit-lines`. Keep this change identical to that commit's hunk so the two merge cleanly. Above the `notEnough` helper in `src/repositories/sqlite/SqliteTransactionRepository.ts`, add:

```ts
/** Refused for lack of money, not because something broke. */
export class NotEnoughError extends Error {}

```

and change `return new Error(` inside `notEnough` to `return new NotEnoughError(`.

- [ ] **Step 1: Replace `src/db/recurring.ts`**

Replace the whole file with:

```ts
import { recurringTransactionRepo, transactionRepo } from '../repositories';
import { NotEnoughError } from '../repositories/sqlite/SqliteTransactionRepository';
import { nextOccurrences } from '../utils/recurring';
import { nowIso } from '../utils/date';
import type { RecurringTransaction } from '../domain/types';

export interface StuckRecurring { rule: RecurringTransaction; notEnough: boolean; }

let running: Promise<StuckRecurring[]> | null = null;

/**
 * Post every due-but-not-yet-posted occurrence of every recurring rule, as ordinary
 * transactions (so balance updates and credit-sync happen through the normal path).
 * Safe to call on every dashboard load — nextOccurrences is idempotent against the rule's
 * own lastMaterializedDate, so a rule already caught up produces nothing.
 * Returns the rules it couldn't bring up to date.
 */
export function materializeRecurringTransactions(): Promise<StuckRecurring[]> {
  // A second caller shares the run in progress: two at once could post a bill twice.
  if (!running) running = postDueOccurrences().finally(() => { running = null; });
  return running;
}

async function postDueOccurrences(): Promise<StuckRecurring[]> {
  const rules = await recurringTransactionRepo.list();
  const today = nowIso();
  const stuck: StuckRecurring[] = [];
  for (const rule of rules) {
    const occurrences = nextOccurrences(rule, rule.lastMaterializedDate, today);
    if (occurrences.length === 0) continue;
    let posted: string | null = null;
    for (const date of occurrences) {
      try {
        await transactionRepo.create({
          date, amount: rule.amount, type: rule.type,
          categoryId: rule.categoryId ?? undefined, accountId: rule.accountId,
          note: rule.note ?? undefined,
        });
        posted = date;
      } catch (e) {
        // Not enough in the account: leave this and later occurrences unposted; they post on a later pass.
        // Anything else stops the rule the same way, but shouldn't pass silently.
        const notEnough = e instanceof NotEnoughError;
        if (!notEnough) console.warn(`Recurring transaction ${rule.id} not posted:`, e);
        stuck.push({ rule, notEnough });
        break;
      }
    }
    if (posted) await recurringTransactionRepo.markMaterialized(rule.id, posted);
  }
  return stuck;
}
```

- [ ] **Step 2: Stop running it at app start in `app/_layout.tsx`**

Delete this line:

```ts
import { materializeRecurringTransactions } from '../src/db/recurring';
```

Replace:

```ts
    getDatabase()
      .then(() => materializeRecurringTransactions())
      .then(() => accountRepo.list())
```

with:

```ts
    getDatabase()
      .then(() => accountRepo.list())
```

- [ ] **Step 3: Add the import to `app/(tabs)/index.tsx`**

Replace:

```ts
import { backupAgeLabel, backupIsStale, LAST_BACKUP_KEY } from '../../src/utils/backupRules';
```

with:

```ts
import { backupAgeLabel, backupIsStale, LAST_BACKUP_KEY } from '../../src/utils/backupRules';
import { materializeRecurringTransactions } from '../../src/db/recurring';
```

- [ ] **Step 4: Add the state**

Replace:

```ts
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
```

with:

```ts
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [stuckBills, setStuckBills] = useState<string[]>([]);
```

- [ ] **Step 5: Run the pass first in `load()`**

It goes before the reads, so a bill that just became payable shows up in the balances. Replace:

```ts
    setLoading(true);
    // ponytail: sequential to avoid expo-sqlite concurrent promise queue bug
    const accs = await accountRepo.list();
```

with:

```ts
    setLoading(true);
    const stuck = await materializeRecurringTransactions();
    // ponytail: sequential to avoid expo-sqlite concurrent promise queue bug
    const accs = await accountRepo.list();
```

- [ ] **Step 6: Build the notice lines**

These deliberately don't use `NotEnoughError`'s message: it contains a balance the user may have hidden. Replace:

```ts
    setCategoryMap(Object.fromEntries(cats.map((c) => [c.id, c.name])));
```

with:

```ts
    const categoryNames: Record<string, string> = Object.fromEntries(cats.map((c) => [c.id, c.name]));
    setCategoryMap(categoryNames);
    // No amounts here: the account's balance may be hidden with the eye toggle.
    setStuckBills(stuck.map(({ rule, notEnough }) => {
      const name = rule.note || (rule.categoryId ? categoryNames[rule.categoryId] : null) || 'Recurring bill';
      const account = accs.find((a) => a.id === rule.accountId)?.name ?? 'its account';
      return notEnough ? `${name}: not enough in ${account}` : `${name}: couldn't post`;
    }));
```

- [ ] **Step 7: Render it above the backup notice**

Replace:

```tsx
          {backupNotice && (
```

with:

```tsx
          {stuckBills.length > 0 && (
            <NoticeCard icon="alert-circle" title="Recurring didn't post" lines={stuckBills} onPress={() => router.push('/recurring')} />
          )}

          {backupNotice && (
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0

- [ ] **Step 9: Commit**

```bash
git add src/db/recurring.ts app/_layout.tsx "app/(tabs)/index.tsx"
git commit -m "feat(recurring): show bills that didn't post and retry on the dashboard"
```

---

### Task 7: Verify

No native code changed, so the installed dev client is enough. If the app looks stale, check the Metro connection before blaming the code.

- [ ] **Step 1: Run every self-check**

Run: `for f in src/utils/*.check.mts; do node --experimental-strip-types "$f" || echo "FAILED: $f"; done`
Expected: each file prints `all checks passed` and nothing prints `FAILED`

- [ ] **Step 2: Run the merge gates from `AGENTS.md`**

Run: `npx tsc --noEmit && npx expo-doctor`
Expected: no type errors and all doctor checks pass

- [ ] **Step 3: Start the app on the test phone**

Run: `npx expo start --dev-client`

- [ ] **Step 4: Backup round trip**

With a scanned receipt (with line items) and an investment contract in the app:
1. Back up from Settings and save the file somewhere outside the app.
2. Remove all data. It should complete and land on onboarding.
3. Go through onboarding, then restore the file.

Expected: the receipt photo and its line items are back, and the contract PDF opens.

- [ ] **Step 5: Older backup**

Restore a backup file made before this branch.
Expected: it restores with no error.

- [ ] **Step 6: Stuck recurring bill**

1. Create a monthly recurring expense due today, on an account that can't cover it.
2. Return to the dashboard.
3. Hide the balance with the eye toggle.
4. Transfer enough into that account and return to the dashboard.

Expected: after step 2 the notice shows `<name>: not enough in <account>` and nothing posts. After step 3 the notice still shows no balance. After step 4 exactly one transaction exists and the notice is gone.

- [ ] **Step 7: Backup reminder**

1. Temporarily change `BACKUP_STALE_DAYS` in `src/utils/backupRules.ts` to `1 / 1440` (one minute).
2. Wait a minute and return to the dashboard. The notice appears, and tapping it opens Settings.
3. Back up, then return to the dashboard straight away. The notice is gone and Settings shows `Last backup: today`.
4. Undo the temporary change: `git checkout -- src/utils/backupRules.ts`.

- [ ] **Step 8: Report**

Report each step's result as it happened, including anything that failed or wasn't run.
