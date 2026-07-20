import type { LendingPayment, CreateLendingPaymentInput } from '../domain/types';

export interface ILendingPaymentRepository {
  list(): Promise<LendingPayment[]>;
  listByLending(lendingId: string): Promise<LendingPayment[]>;
  getById(id: string): Promise<LendingPayment | null>;
  create(lendingId: string, input: CreateLendingPaymentInput): Promise<LendingPayment>;
  softDelete(id: string): Promise<void>;
}
