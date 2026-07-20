import type { Lending, CreateLendingInput, UpdateLendingInput } from '../domain/types';

export interface ILendingRepository {
  list(): Promise<Lending[]>;
  getById(id: string): Promise<Lending | null>;
  create(input: CreateLendingInput): Promise<Lending>;
  update(id: string, input: UpdateLendingInput): Promise<Lending>;
  markPaid(id: string): Promise<Lending>;
  softDelete(id: string): Promise<void>;
}
