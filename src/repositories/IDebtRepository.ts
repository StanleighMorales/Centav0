import type { Debt, CreateDebtInput, UpdateDebtInput } from '../domain/types';

export interface IDebtRepository {
  list(): Promise<Debt[]>;
  getById(id: string): Promise<Debt | null>;
  create(input: CreateDebtInput): Promise<Debt>;
  update(id: string, input: UpdateDebtInput): Promise<Debt>;
  markPaid(id: string): Promise<Debt>;
  softDelete(id: string): Promise<void>;
}
