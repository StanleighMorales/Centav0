import type { DebtPayment, CreateDebtPaymentInput } from '../domain/types';

export interface IDebtPaymentRepository {
  listByDebt(debtId: string): Promise<DebtPayment[]>;
  getById(id: string): Promise<DebtPayment | null>;
  create(debtId: string, input: CreateDebtPaymentInput): Promise<DebtPayment>;
  softDelete(id: string): Promise<void>;
}
