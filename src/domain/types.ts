export interface AuditFields {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LocalSyncFields {
  isDirty: boolean;
  syncedAt: string | null;
}

export type AccountType = 'Cash' | 'Bank' | 'EWallet' | 'CreditCard' | 'Other';

export interface Account extends AuditFields, LocalSyncFields {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  currentBalance: number;
  /** Day of month (1–31) the credit card statement is generated. CreditCard only. */
  billDay: number | null;
  /** Day of month (1–31) the credit card payment is due. CreditCard only. */
  dueDay: number | null;
}

export interface CreateAccountInput {
  name: string; type: AccountType; initialBalance: number;
  billDay?: number; dueDay?: number;
}
export interface UpdateAccountInput { name?: string; type?: AccountType; billDay?: number; dueDay?: number; }

export type CategoryType = 'Expense' | 'Income';

export interface Category extends AuditFields, LocalSyncFields {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
}

export interface CreateCategoryInput { name: string; type: CategoryType; icon?: string; color?: string; }
export interface UpdateCategoryInput { name?: string; icon?: string; color?: string; }

export type TransactionType = 'Expense' | 'Income' | 'Transfer';

export interface Transaction extends AuditFields, LocalSyncFields {
  id: string;
  userId: string;
  date: string;
  amount: number;
  type: TransactionType;
  categoryId: string | null;
  accountId: string;
  /** Destination account. Set only when type === 'Transfer'. */
  toAccountId: string | null;
  note: string | null;
  receiptUri: string | null;
}

export interface CreateTransactionInput {
  date: string; amount: number; type: TransactionType;
  categoryId?: string; accountId: string; note?: string; receiptUri?: string;
}
export interface UpdateTransactionInput {
  date?: string; amount?: number; type?: TransactionType;
  categoryId?: string; accountId?: string; note?: string; receiptUri?: string;
}
export interface TransactionFilter {
  from?: string; to?: string; type?: TransactionType;
  categoryId?: string; accountId?: string;
}

export interface CreateTransferInput {
  date: string; amount: number;
  accountId: string; toAccountId: string; note?: string;
}

export type DebtStatus = 'Open' | 'Paid' | 'Overdue';

export interface Debt extends AuditFields, LocalSyncFields {
  id: string;
  userId: string;
  creditor: string;
  originalAmount: number;
  outstandingBalance: number;
  dueDate: string | null;
  status: DebtStatus;
  interestRate: number | null;
  note: string | null;
  isInstallment: boolean;
  monthlyPayment: number | null;
  installmentFee: number | null;
}

export interface CreateDebtInput {
  creditor: string; originalAmount: number;
  dueDate?: string; interestRate?: number; note?: string;
  isInstallment?: boolean; monthlyPayment?: number; installmentFee?: number;
}
export interface UpdateDebtInput {
  creditor?: string; dueDate?: string; interestRate?: number; note?: string;
  isInstallment?: boolean; monthlyPayment?: number; installmentFee?: number;
}

export interface DebtPayment extends AuditFields, LocalSyncFields {
  id: string; userId: string; debtId: string;
  date: string; amount: number; accountId: string;
}
export interface CreateDebtPaymentInput { date: string; amount: number; accountId: string; }

export type AllocationPeriod = 'Weekly' | 'Monthly';

export interface Allocation extends AuditFields, LocalSyncFields {
  id: string; userId: string;
  categoryId: string | null; accountId: string | null;
  amount: number; period: AllocationPeriod; startDate: string;
}
export interface CreateAllocationInput {
  categoryId?: string; accountId?: string;
  amount: number; period: AllocationPeriod; startDate: string;
}
export interface AllocationProgress { allocated: number; spent: number; remaining: number; percent: number; }

export interface SpentSummary { from: string; to: string; total: number; count: number; }
export interface CategoryBreakdown { categoryId: string; categoryName: string; total: number; count: number; }
