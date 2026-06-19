import type { Allocation, CreateAllocationInput, AllocationProgress } from '../domain/types';

export interface IAllocationRepository {
  list(): Promise<Allocation[]>;
  getById(id: string): Promise<Allocation | null>;
  create(input: CreateAllocationInput): Promise<Allocation>;
  update(id: string, input: Partial<CreateAllocationInput>): Promise<Allocation>;
  softDelete(id: string): Promise<void>;
  getProgress(id: string): Promise<AllocationProgress>;
}
