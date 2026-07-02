import type { DebtPayment, CreateDebtPaymentInput } from '../domain/types';

export interface DebtPaymentFilter { from?: string; to?: string; }

export interface IDebtPaymentRepository {
  list(filter?: DebtPaymentFilter): Promise<DebtPayment[]>;
  listByDebt(debtId: string): Promise<DebtPayment[]>;
  getById(id: string): Promise<DebtPayment | null>;
  create(debtId: string, input: CreateDebtPaymentInput): Promise<DebtPayment>;
  softDelete(id: string): Promise<void>;
}
