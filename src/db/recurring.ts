import { recurringTransactionRepo, transactionRepo } from '../repositories';
import { NotEnoughError } from '../repositories/sqlite/SqliteTransactionRepository';
import { nextOccurrences } from '../utils/recurring';
import { nowIso } from '../utils/date';
import type { RecurringTransaction } from '../domain/types';

export interface StuckRecurring { rule: RecurringTransaction; notEnough: boolean; }

let running: Promise<StuckRecurring[]> | null = null;

/**
 * Post every due-but-not-yet-posted occurrence of every recurring rule, as ordinary
 * transactions (so balance updates and credit-sync happen through the normal path).
 * Safe to call on every dashboard load — nextOccurrences is idempotent against the rule's
 * own lastMaterializedDate, so a rule already caught up produces nothing.
 * Returns the rules it couldn't bring up to date.
 */
export function materializeRecurringTransactions(): Promise<StuckRecurring[]> {
  // A second caller shares the run in progress: two at once could post a bill twice.
  if (!running) running = postDueOccurrences().finally(() => { running = null; });
  return running;
}

async function postDueOccurrences(): Promise<StuckRecurring[]> {
  const rules = await recurringTransactionRepo.list();
  const today = nowIso();
  const stuck: StuckRecurring[] = [];
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
      } catch (e) {
        // Not enough in the account: leave this and later occurrences unposted; they post on a later pass.
        // Anything else stops the rule the same way, but shouldn't pass silently.
        const notEnough = e instanceof NotEnoughError;
        if (!notEnough) console.warn(`Recurring transaction ${rule.id} not posted:`, e);
        stuck.push({ rule, notEnough });
        break;
      }
    }
    if (posted) await recurringTransactionRepo.markMaterialized(rule.id, posted);
  }
  return stuck;
}
