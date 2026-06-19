import type { Account, CreateAccountInput, UpdateAccountInput } from '../domain/types';

export interface IAccountRepository {
  list(): Promise<Account[]>;
  getById(id: string): Promise<Account | null>;
  create(input: CreateAccountInput): Promise<Account>;
  update(id: string, input: UpdateAccountInput): Promise<Account>;
  softDelete(id: string): Promise<void>;
  getBalance(id: string): Promise<number>;
}
