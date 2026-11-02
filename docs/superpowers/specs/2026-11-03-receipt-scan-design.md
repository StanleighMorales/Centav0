# Receipt scan: auto-fill a transaction and its item breakdown

## Goal
Photograph or pick a receipt in Add Transaction. The app reads it on-device, prefills the total, date and merchant, and lists the purchased items. The user corrects anything and saves.

## Decisions
- **Extraction:** on-device OCR via `expo-text-extractor` (ML Kit on Android). Free, offline and private. Needs one new EAS dev build.
- **Breakdown:** a viewable, editable list of items (name, qty, price). No per-item categories.

## Flow
1. Add Transaction gets a "Scan receipt" button that opens the camera or gallery (`expo-image-picker`, already installed).
2. The image is copied into app storage and its path saved in the existing `transactions.receiptUri`.
3. OCR returns text lines. A pure parser turns them into `{ total, date, merchant, items[] }`.
4. The form is prefilled: amount = total, date, note = merchant. An editable items list appears below.
5. The user edits and saves. The transaction and its items are written together.

## Parser (`src/utils/receipt.ts`)
- **Total:** the amount on a line matching `TOTAL`, `AMOUNT DUE` or `GRAND TOTAL`. If none matches, use the largest amount.
- **Items:** lines ending in a price, with an optional `2 x` quantity prefix. Skip subtotal, tax, change, cash and card lines.
- **Date:** first recognizable date; otherwise today.
- **Failure:** if nothing parses, the form opens with the photo attached and empty fields. Saving is never blocked.
- **Check:** `src/utils/receipt.check.mts` with sample receipt texts, in the style of `calc.check.mts`.

## Data
- New migration adds `transaction_items(id, transactionId, name, qty, price, createdAt, updatedAt, deletedAt, isDirty, syncedAt)`.
- Item sum is not forced to equal the transaction total (tax, discounts). The form shows a "difference" line.
- Deleting or undoing a transaction soft-deletes its items. Backup and restore include the new table.
- New `SqliteTransactionItemRepository`, wired in `src/repositories/index.ts`.

## UI
- `ReceiptItemsEditor` component (add, edit, remove rows) used for both scan and edit.
- Transaction detail shows the receipt thumbnail, the total and the item list.

## Out of scope
Per-item categories, cloud OCR, multi-page receipts.

## Risks
- OCR quality varies with lighting and receipt format. Mitigated by the editable review step.
- A new native module means a new dev build before on-device testing.
