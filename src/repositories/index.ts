import { SqliteAccountRepository } from './sqlite/SqliteAccountRepository';
import { SqliteCategoryRepository } from './sqlite/SqliteCategoryRepository';
import { SqliteTransactionRepository } from './sqlite/SqliteTransactionRepository';
import { SqliteDebtRepository } from './sqlite/SqliteDebtRepository';
import { SqliteDebtPaymentRepository } from './sqlite/SqliteDebtPaymentRepository';
import { SqliteAllocationRepository } from './sqlite/SqliteAllocationRepository';
import type { IAccountRepository } from './IAccountRepository';
import type { ICategoryRepository } from './ICategoryRepository';
import type { ITransactionRepository } from './ITransactionRepository';
import type { IDebtRepository } from './IDebtRepository';
import type { IDebtPaymentRepository } from './IDebtPaymentRepository';
import type { IAllocationRepository } from './IAllocationRepository';

export const accountRepo: IAccountRepository = new SqliteAccountRepository();
export const categoryRepo: ICategoryRepository = new SqliteCategoryRepository();
export const transactionRepo: ITransactionRepository = new SqliteTransactionRepository();
export const debtRepo: IDebtRepository = new SqliteDebtRepository();
export const debtPaymentRepo: IDebtPaymentRepository = new SqliteDebtPaymentRepository();
export const allocationRepo: IAllocationRepository = new SqliteAllocationRepository();

export { getSetting, setSetting } from './settings';

export type { IAccountRepository, ICategoryRepository, ITransactionRepository, IDebtRepository, IDebtPaymentRepository, IAllocationRepository };
