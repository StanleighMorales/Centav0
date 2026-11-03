# Data safety: backups, stuck recurring bills, and reset

## Problem

Centav0 keeps everything on the phone, so the backup file is the only other copy, and the balance is only as good as
what got posted. Four things undercut that:

- Backups copy the database but not the receipt photos or contract PDFs, which are separate files. Settings warns about
  the PDFs, but nothing warns about receipts. A restore on a new phone leaves broken links.
- Backups only happen when the user remembers, and nothing says how old the last one is.
- A recurring bill the account can't cover is skipped with no message and only retries on the next app start, so the
  balance looks higher than it really is.
- "Remove all data" misses `transaction_items` and leaves the photos and PDFs on the phone.

## Design

No schema migration and no new dependency. This is JS only, so it needs no new dev client build and doesn't touch the
uncommitted loan migration.

### Attachments inside the backup

The backup stays one `.db` file. Attachments go in a table that only ever exists in the backup file:

`_attachments (uri TEXT PRIMARY KEY, data BLOB NOT NULL)`

Export (`exportBackup`), after the existing snapshot and before sharing:

1. Create the table in the snapshot.
2. Collect `transactions.receiptUri` and `investment_documents.uri`. Soft-deleted rows count, so restored archive rows
   keep their files.
3. For each URI, read it with `file.bytes()` and insert it, one file at a time so memory peaks at a single file. A file
   that no longer exists is skipped.
4. Run `PRAGMA wal_checkpoint(TRUNCATE)` before closing. The snapshot inherits WAL mode from the live database, and the
   rows must be in the `.db` file before it's shared.

Restore (`restoreBackup`), after the existing validation and before copying into the live database:

1. If the staged file has no `_attachments` table, skip the rest of this list, so older backups still restore.
2. For each row, get the destination from `attachmentDest(uri)`, write the file under `Paths.document`, and update the
   matching `receiptUri` / `uri` in the staged database. The new phone's storage path can differ from the old one.
3. Run `DROP TABLE _attachments; VACUUM;` on the staged database, so the live database never carries the blobs.
4. Copy into the live database as today.

Files are written first, so a failure leaves the live database untouched, with at worst a few stray files.

`attachmentDest(uri)` uses only the file name, which must be a plain `name.ext` with a known image or PDF extension. The
extension picks the folder: PDFs go to `contracts/`, images to `receipts/`. Backup files come from outside the app, so
anything else, including `..`, is skipped. Receipts from before the scan feature sit in the image picker's cache folder,
so restoring also moves them somewhere permanent.

Settings loses the line "Backups include investment records but not their contract PDFs."

### Backup reminder

- `exportBackup` saves `lastBackupAt` in settings once the share sheet closes. `restoreBackup` saves it after restoring,
  otherwise the older value inside the file would win.
- Settings shows "Last backup: 23 days ago" or "No backup yet" under Back up now.
- The dashboard shows a notice once the last backup is 14 or more days old. With no backup yet, the clock starts at the
  oldest transaction (the last row of `transactionRepo.list()`), so a new user isn't nagged on day one and an empty app
  shows nothing. Tapping opens Settings. There's no dismiss: backing up clears it.
- The rule is a pure function, `backupIsStale(lastBackupAt, oldestTransactionDate, now)`.

Known limit: `shareAsync` returns nothing about the outcome, so cancelling the share sheet counts as a backup.

### Stuck recurring bills

- `materializeRecurringTransactions` returns what it couldn't post, as `{ rule, notEnough }[]`.
- The call moves from app start (`app/_layout.tsx`) to the start of the dashboard's `load()`. Adding money then posts a
  waiting bill on return to the dashboard instead of on the next cold start, and bills that come due while the app stays
  open post too.
- `load()` can run twice at once (focus plus `onDataChanged`), and two runs could post a bill twice, so a second call
  gets the first call's in-flight promise.
- The dashboard shows a notice below the balance card with one line per stuck bill: `Rent: not enough in GCash`, or
  `Rent: couldn't post` for any other error. The name is the rule's note, then its category, then "Recurring bill".
  Tapping opens Recurring. The notice goes away by itself once the bill posts.
- The notice doesn't reuse `NotEnoughError`'s message ("Only ₱120.00 left in GCash"), because that would show a balance
  the user may have hidden with the eye toggle.

Both dashboard notices share one small `NoticeCard` in `src/components/dashboard/`.

### Remove all data

- Add `transaction_items` to `RESETTABLE_TABLES`, before `transactions`. Its foreign key, with `foreign_keys = ON`,
  should make the delete fail once any scanned receipt has line items, which rolls the whole reset back.
- `handleReset` has no `catch`, so that failure is silent. Show the error the way backup does.
- Delete the `receipts/` and `contracts/` folders once the rows are cleared.

### Out of scope

- Automatic scheduled backups. They need a folder the app can write to on its own. Revisit if the reminder isn't enough.
- An option to leave receipts out of a backup. Add it if backups get too big to share.
- Snoozing the reminder.
- Cleaning up old files when a restore replaces the data.

Backups now grow with the attachments. A few hundred receipts could reach hundreds of MB, and a restore briefly needs
about two extra copies of the file in cache.

## Testing

Self-check `src/utils/backupRules.check.mts`, covering `attachmentDest` (current receipt, older cached receipt, contract,
`..`, unknown file type) and `backupIsStale` (13 and 14 days, never backed up, no transactions).

On the test phone:

1. Back up with a scanned receipt and a contract, remove all data, restore. Both open and the line items are back.
2. Restore a backup made before this change. It restores with no error.
3. Remove all data with a scanned receipt present. It completes and the `receipts/` folder is gone.
4. Let a recurring bill come due on a short account. The notice appears and nothing posts. Transfer money in and return
   to the dashboard. The bill posts exactly once and the notice clears.
5. Hide the balances with the eye toggle. The notice shows no balance.
6. Temporarily shorten the 14-day limit. The notice appears, backing up clears it, and Settings shows the new date.

`npx tsc --noEmit` and `npx expo-doctor` must pass.
