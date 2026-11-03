import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { roundCentavos } from '../../utils/currency';
import { FIXED_USER_ID } from '../../constants/user';
import type { TransactionItem, TransactionItemInput } from '../../domain/types';

const toItem = (row: any): TransactionItem => ({
  id: row.id, userId: row.userId, transactionId: row.transactionId,
  name: row.name, qty: row.qty, price: row.price,
  createdAt: row.createdAt, updatedAt: row.updatedAt, deletedAt: row.deletedAt ?? null,
  isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
});

export class SqliteTransactionItemRepository {
  async listByTransaction(transactionId: string): Promise<TransactionItem[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM transaction_items WHERE transactionId = ? AND userId = ? AND deletedAt IS NULL ORDER BY createdAt, rowid`,
      [transactionId, FIXED_USER_ID],
    );
    return rows.map(toItem);
  }

  // ponytail: replace-all on save (soft-delete old rows, insert new) instead of diffing; receipts have a handful of rows.
  async replaceForTransaction(transactionId: string, items: TransactionItemInput[]): Promise<void> {
    const db = await getDatabase();
    const now = nowIso();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE transaction_items SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE transactionId = ? AND userId = ? AND deletedAt IS NULL`,
        [now, now, transactionId, FIXED_USER_ID],
      );
      for (const it of items) {
        await db.runAsync(
          `INSERT INTO transaction_items (id, userId, transactionId, name, qty, price, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
          [newId(), FIXED_USER_ID, transactionId, it.name, it.qty, roundCentavos(it.price), now, now],
        );
      }
    });
  }
}
