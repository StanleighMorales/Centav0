import type { AccountType, CreateAccountTypeInput, UpdateAccountTypeInput } from '../domain/types';

export interface IAccountTypeRepository {
  list(): Promise<AccountType[]>;
  getById(id: string): Promise<AccountType | null>;
  create(input: CreateAccountTypeInput): Promise<AccountType>;
  update(id: string, input: UpdateAccountTypeInput): Promise<AccountType>;
  softDelete(id: string): Promise<void>;
}
