import type { Transaction, CreateTransactionInput, UpdateTransactionInput, TransactionFilter } from '../domain/types';

export interface ITransactionRepository {
  list(filter?: TransactionFilter): Promise<Transaction[]>;
  getById(id: string): Promise<Transaction | null>;
  create(input: CreateTransactionInput): Promise<Transaction>;
  update(id: string, input: UpdateTransactionInput): Promise<Transaction>;
  softDelete(id: string): Promise<void>;
}
