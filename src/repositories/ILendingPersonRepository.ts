import type { LendingPerson, CreateLendingPersonInput, UpdateLendingPersonInput } from '../domain/types';

export interface ILendingPersonRepository {
  list(): Promise<LendingPerson[]>;
  getById(id: string): Promise<LendingPerson | null>;
  create(input: CreateLendingPersonInput): Promise<LendingPerson>;
  update(id: string, input: UpdateLendingPersonInput): Promise<LendingPerson>;
  softDelete(id: string): Promise<void>;
}
