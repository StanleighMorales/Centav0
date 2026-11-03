import { recurringTransactionRepo, transactionRepo } from '../repositories';
import { nextOccurrences } from '../utils/recurring';
import { nowIso } from '../utils/date';

/**
 * Post every due-but-not-yet-posted occurrence of every recurring rule, as ordinary
 * transactions (so balance updates and credit-sync happen through the normal path).
 * Safe to call on every app boot — nextOccurrences is idempotent against the rule's
 * own lastMaterializedDate, so a rule already caught up produces nothing.
 */
export async function materializeRecurringTransactions(): Promise<void> {
  const rules = await recurringTransactionRepo.list();
  const today = nowIso();
  for (const rule of rules) {
    const occurrences = nextOccurrences(rule, rule.lastMaterializedDate, today);
    if (occurrences.length === 0) continue;
    let posted: string | null = null;
    for (const date of occurrences) {
      try {
        await transactionRepo.create({
          date, amount: rule.amount, type: rule.type,
          categoryId: rule.categoryId ?? undefined, accountId: rule.accountId,
          note: rule.note ?? undefined,
        });
        posted = date;
      } catch {
        // Not enough in the account: leave this and later occurrences unposted; they post on a later start.
        break;
      }
    }
    if (posted) await recurringTransactionRepo.markMaterialized(rule.id, posted);
  }
}
