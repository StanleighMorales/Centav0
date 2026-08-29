import type { RecurringTransaction, CreateRecurringTransactionInput, UpdateRecurringTransactionInput } from '../domain/types';

export interface IRecurringTransactionRepository {
  list(): Promise<RecurringTransaction[]>;
  getById(id: string): Promise<RecurringTransaction | null>;
  create(input: CreateRecurringTransactionInput): Promise<RecurringTransaction>;
  update(id: string, input: UpdateRecurringTransactionInput): Promise<RecurringTransaction>;
  softDelete(id: string): Promise<void>;
  markMaterialized(id: string, lastMaterializedDate: string): Promise<void>;
}
