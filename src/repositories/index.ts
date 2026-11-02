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
import { SqliteRecurringTransactionRepository } from './sqlite/SqliteRecurringTransactionRepository';
import { SqliteInvestmentRepository } from './sqlite/SqliteInvestmentRepository';

export const investmentRepo = new SqliteInvestmentRepository();
export const accountRepo = new SqliteAccountRepository();
export const accountTypeRepo = new SqliteAccountTypeRepository();
export const categoryRepo = new SqliteCategoryRepository();
export const transactionRepo = new SqliteTransactionRepository();
export const debtRepo = new SqliteDebtRepository();
export const debtPaymentRepo = new SqliteDebtPaymentRepository();
export const allocationRepo = new SqliteAllocationRepository();
export const lendingPersonRepo = new SqliteLendingPersonRepository();
export const lendingRepo = new SqliteLendingRepository();
export const lendingPaymentRepo = new SqliteLendingPaymentRepository();
export const recurringTransactionRepo = new SqliteRecurringTransactionRepository();

export { getSetting, setSetting } from './settings';
