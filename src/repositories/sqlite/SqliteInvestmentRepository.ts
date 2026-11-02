import { getDatabase } from '../../db/database';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { roundCentavos } from '../../utils/currency';
import { FIXED_USER_ID } from '../../constants/user';
import type {
  Investment, CreateInvestmentInput, UpdateInvestmentInput,
  InvestmentUpdate, CreateInvestmentUpdateInput,
  InvestmentDocument, CreateInvestmentDocumentInput,
} from '../../domain/types';

const audit = (row: any) => ({
  createdAt: row.createdAt, updatedAt: row.updatedAt, deletedAt: row.deletedAt ?? null,
  isDirty: row.isDirty === 1, syncedAt: row.syncedAt ?? null,
});

const toInvestment = (row: any): Investment => ({
  id: row.id, userId: row.userId, name: row.name, amountPaid: row.amountPaid,
  stakePct: row.stakePct ?? null, expectedReturnPct: row.expectedReturnPct ?? null,
  startDate: row.startDate, status: row.status, note: row.note ?? null, ...audit(row),
});
const toUpdate = (row: any): InvestmentUpdate => ({
  id: row.id, userId: row.userId, investmentId: row.investmentId, date: row.date,
  amount: row.amount, stakePct: row.stakePct ?? null, note: row.note ?? null, ...audit(row),
});
const toDocument = (row: any): InvestmentDocument => ({
  id: row.id, userId: row.userId, investmentId: row.investmentId,
  name: row.name, uri: row.uri, size: row.size ?? null, ...audit(row),
});

// Investments, their dated updates and their contract files live together: they're only ever read and written as one unit.
export class SqliteInvestmentRepository {
  async list(): Promise<Investment[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM investments WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAt DESC`, [FIXED_USER_ID],
    );
    return rows.map(toInvestment);
  }

  async getById(id: string): Promise<Investment | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM investments WHERE id = ? AND userId = ? AND deletedAt IS NULL`, [id, FIXED_USER_ID],
    );
    return row ? toInvestment(row) : null;
  }

  async create(input: CreateInvestmentInput): Promise<Investment> {
    const db = await getDatabase();
    const id = newId();
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO investments (id, userId, name, amountPaid, stakePct, expectedReturnPct, startDate, status, note, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, NULL, 1, NULL)`,
      [id, FIXED_USER_ID, input.name, roundCentavos(input.amountPaid), input.stakePct ?? null, input.expectedReturnPct ?? null,
        input.startDate, input.note ?? null, now, now],
    );
    const created = await this.getById(id);
    if (!created) throw new Error('Investment creation failed silently');
    return created;
  }

  async update(id: string, input: UpdateInvestmentInput): Promise<Investment> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Investment ${id} not found`);
    const pick = <K extends keyof UpdateInvestmentInput>(k: K, cur: any) => (k in input ? (input[k] ?? null) : cur);
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE investments SET name = ?, stakePct = ?, expectedReturnPct = ?, note = ?, status = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`,
      [input.name ?? existing.name, pick('stakePct', existing.stakePct), pick('expectedReturnPct', existing.expectedReturnPct),
        pick('note', existing.note), input.status ?? existing.status, nowIso(), id, FIXED_USER_ID],
    );
    return (await this.getById(id))!;
  }

  async softDelete(id: string): Promise<void> {
    const db = await getDatabase();
    const now = nowIso();
    await db.withTransactionAsync(async () => {
      for (const table of ['investments', 'investment_updates', 'investment_documents']) {
        const col = table === 'investments' ? 'id' : 'investmentId';
        await db.runAsync(
          `UPDATE ${table} SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE ${col} = ? AND userId = ? AND deletedAt IS NULL`,
          [now, now, id, FIXED_USER_ID],
        );
      }
    });
  }

  async listUpdates(investmentId: string): Promise<InvestmentUpdate[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM investment_updates WHERE investmentId = ? AND userId = ? AND deletedAt IS NULL ORDER BY date DESC, createdAt DESC`,
      [investmentId, FIXED_USER_ID],
    );
    return rows.map(toUpdate);
  }

  /** Every live update, for list-screen totals. */
  async listAllUpdates(): Promise<InvestmentUpdate[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT u.* FROM investment_updates u JOIN investments i ON i.id = u.investmentId
       WHERE u.userId = ? AND u.deletedAt IS NULL AND i.deletedAt IS NULL`,
      [FIXED_USER_ID],
    );
    return rows.map(toUpdate);
  }

  async addUpdate(investmentId: string, input: CreateInvestmentUpdateInput): Promise<void> {
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO investment_updates (id, userId, investmentId, date, amount, stakePct, note, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
      [newId(), FIXED_USER_ID, investmentId, input.date, roundCentavos(input.amount), input.stakePct ?? null, input.note ?? null, now, now],
    );
  }

  async deleteUpdate(id: string): Promise<void> {
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE investment_updates SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`, [now, now, id, FIXED_USER_ID],
    );
  }

  async listDocuments(investmentId: string): Promise<InvestmentDocument[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM investment_documents WHERE investmentId = ? AND userId = ? AND deletedAt IS NULL ORDER BY createdAt DESC`,
      [investmentId, FIXED_USER_ID],
    );
    return rows.map(toDocument);
  }

  async addDocument(investmentId: string, input: CreateInvestmentDocumentInput): Promise<void> {
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO investment_documents (id, userId, investmentId, name, uri, size, createdAt, updatedAt, deletedAt, isDirty, syncedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
      [newId(), FIXED_USER_ID, investmentId, input.name, input.uri, input.size ?? null, now, now],
    );
  }

  async deleteDocument(id: string): Promise<void> {
    const db = await getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE investment_documents SET deletedAt = ?, updatedAt = ?, isDirty = 1 WHERE id = ? AND userId = ?`, [now, now, id, FIXED_USER_ID],
    );
  }
}
