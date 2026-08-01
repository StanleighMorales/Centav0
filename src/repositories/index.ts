import { SqliteAccountRepository } from './sqlite/SqliteAccountRepository';
import { SqliteAccountTypeRepository } from './sqlite/SqliteAccountTypeRepository';
import { SqliteCategoryRepository } from './sqlite/SqliteCategoryRepository';
import { SqliteTransactionRepository } from './sqlite/SqliteTransactionRepository';
import { SqliteDebtRepository } from './sqlite/SqliteDebtRepository';
import { SqliteDebtPaymentRepository } from './sqlite/SqliteDebtPaymentRepository';
import { SqliteAllocationRepository } from './sqlite/SqliteAllocationRepository';
import { SqliteLendingPersonRepository } from './sqlite/SqliteLendingPersonRepository';
import { SqliteLendingRepository } from './sqlite/SqliteLendingRepository';
import { SqliteLendingPaymentRepository } from './sqlite/SqliteLendingPaymentRepository';
import type { IAccountRepository } from './IAccountRepository';
import type { IAccountTypeRepository } from './IAccountTypeRepository';
import type { ICategoryRepository } from './ICategoryRepository';
import type { ITransactionRepository } from './ITransactionRepository';
import type { IDebtRepository } from './IDebtRepository';
import type { IDebtPaymentRepository } from './IDebtPaymentRepository';
import type { IAllocationRepository } from './IAllocationRepository';
import type { ILendingPersonRepository } from './ILendingPersonRepository';
import type { ILendingRepository } from './ILendingRepository';
import type { ILendingPaymentRepository } from './ILendingPaymentRepository';

export const accountRepo: IAccountRepository = new SqliteAccountRepository();
export const accountTypeRepo: IAccountTypeRepository = new SqliteAccountTypeRepository();
export const categoryRepo: ICategoryRepository = new SqliteCategoryRepository();
export const transactionRepo: ITransactionRepository = new SqliteTransactionRepository();
export const debtRepo: IDebtRepository = new SqliteDebtRepository();
export const debtPaymentRepo: IDebtPaymentRepository = new SqliteDebtPaymentRepository();
export const allocationRepo: IAllocationRepository = new SqliteAllocationRepository();
export const lendingPersonRepo: ILendingPersonRepository = new SqliteLendingPersonRepository();
export const lendingRepo: ILendingRepository = new SqliteLendingRepository();
export const lendingPaymentRepo: ILendingPaymentRepository = new SqliteLendingPaymentRepository();

export { getSetting, setSetting } from './settings';

export type {
  IAccountRepository, IAccountTypeRepository, ICategoryRepository, ITransactionRepository, IDebtRepository, IDebtPaymentRepository, IAllocationRepository,
  ILendingPersonRepository, ILendingRepository, ILendingPaymentRepository,
};
