import type { DebtPayment, CreateDebtPaymentInput, SettleChargesInput } from '../domain/types';

export interface DebtPaymentFilter { from?: string; to?: string; }

export interface IDebtPaymentRepository {
  list(filter?: DebtPaymentFilter): Promise<DebtPayment[]>;
  listByDebt(debtId: string): Promise<DebtPayment[]>;
  getById(id: string): Promise<DebtPayment | null>;
  create(debtId: string, input: CreateDebtPaymentInput): Promise<DebtPayment>;
  /** Pay off specific Credit Card charges: frees that much credit and marks them settled. */
  settle(debtId: string, input: SettleChargesInput): Promise<void>;
  softDelete(id: string): Promise<void>;
}
