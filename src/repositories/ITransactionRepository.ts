import type { Transaction, CreateTransactionInput, UpdateTransactionInput, TransactionFilter, CreateTransferInput } from '../domain/types';

export interface ITransactionRepository {
  list(filter?: TransactionFilter): Promise<Transaction[]>;
  getById(id: string): Promise<Transaction | null>;
  create(input: CreateTransactionInput): Promise<Transaction>;
  createTransfer(input: CreateTransferInput): Promise<Transaction>;
  update(id: string, input: UpdateTransactionInput): Promise<Transaction>;
  softDelete(id: string): Promise<void>;
}
