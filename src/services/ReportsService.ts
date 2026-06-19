import { getDatabase } from '../db/database';
import { FIXED_USER_ID } from '../constants/user';
import type { SpentSummary, CategoryBreakdown } from '../domain/types';

export async function getSpentSummary(from: string, to: string): Promise<SpentSummary> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
     FROM transactions
     WHERE userId = ? AND type = 'Expense' AND date >= ? AND date <= ? AND deletedAt IS NULL`,
    [FIXED_USER_ID, from, to],
  );
  return { from, to, total: row?.total ?? 0, count: row?.count ?? 0 };
}

export async function getCategoryBreakdown(from: string, to: string): Promise<CategoryBreakdown[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT t.categoryId, c.name as categoryName,
            COALESCE(SUM(t.amount), 0) as total, COUNT(*) as count
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.categoryId
     WHERE t.userId = ? AND t.type = 'Expense' AND t.date >= ? AND t.date <= ? AND t.deletedAt IS NULL
     GROUP BY t.categoryId
     ORDER BY total DESC`,
    [FIXED_USER_ID, from, to],
  );
  return rows.map((r: any) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName ?? 'Unknown',
    total: r.total,
    count: r.count,
  }));
}
