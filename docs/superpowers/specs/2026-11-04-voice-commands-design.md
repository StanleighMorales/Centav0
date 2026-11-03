# Voice commands: transfer and pay by voice

## Goal
Speak a money move into the existing Voice button ("transfer all cash to gcash", "pay my loan on atome with gcash") and the app opens the right sheet, already filled in. The user reviews and taps Confirm. Nothing moves money without that tap.

## Decisions
- **One mic.** The Voice button in the hold-+ dial (and inside Add Transaction) handles everything. Plain spending still prefills Add Transaction as today.
- **Prefill, never execute.** Speech can mishear amounts, so voice only fills sheets.
- **No debt named → ask.** "pay my monthly balance with gcash" opens a picker of open debts.
- **English only** for now.

## Parser (`src/utils/voiceCommand.ts`)
`parseVoiceCommand(text, accounts, debts)` returns one of:
- `{ kind: 'transfer', fromId, toId, amount }`. Triggered by a leading `transfer | move | send`. The account after `to | into` is `toId`; the other named account is `fromId`. `all | everything | whole balance` sets `amount` to the source's `currentBalance`. An unnamed account or missing amount is `null`.
- `{ kind: 'pay', debtId, accountId, amount }`. Triggered by `pay`. The account after `with | using | from | via` is `accountId`. That phrase is cut out first, then the debt is matched in what's left by creditor name, longest first. Card debts are auto-created with the card account's name as creditor, so "pay my maribank card with gcash" picks the MariBank debt even though MariBank is also an account. A spoken amount sets `amount` (Custom mode). Otherwise `amount` is `null` and the sheet uses its normal default: Monthly for installments, Full otherwise.
- `{ kind: 'transaction' }` for anything else. The caller falls back to `parseVoiceTransaction` unchanged.

Names reuse the account matching from `voiceTransaction.ts` (word-boundary, escaped, longest first). Only open (not Paid) debts are matched.

## Routing
1. `AddTransactionSheet.applyVoice` runs `parseVoiceCommand` first. Its accounts are already loaded; it also loads debts while open. For `transfer` / `pay` it calls a new `onVoiceCommand(cmd)` prop and closes.
2. `app/(tabs)/_layout.tsx` handles the command:
   - **transfer:** opens a `TransferSheet` rendered in the layout, with a new `initial={ accountId, toAccountId, amount }` prop.
   - **pay with `debtId`:** `router.push({ pathname: '/debts/[id]', params: { id, pay: '1', accountId?, amount? } })`. Once loaded, the debt screen opens one sheet, once:
     - card debt with unpaid charges → the existing "Pay All" settle sheet. A spoken amount is ignored, because settle pays whole charges.
     - card debt with no charges → nothing to pay; the screen just shows.
     - any other open debt → the Payment sheet with the pre-picked account and amount.
   - **pay without `debtId`:** opens `DebtPickerSheet`, which lists debts with `outstandingBalance > 0` by due date (no due date last). Tapping one pushes the debt route as above.
3. `AddPaymentSheet` gains `initialAccountId?` and `initialAmount?` props. An initial amount selects Custom mode. Settle mode only uses the account.

## Failure
- An unrecognized name leaves that field blank; the user picks it in the sheet.
- No debts at all → the picker shows an empty state.
- Existing sheet validation (overdraw, overpay) still applies.

## Check
`src/utils/voiceCommand.check.mts`, in the style of `voiceTransaction.check.mts`:
- "transfer all cash to gcash" → full Cash balance, Cash → GCash
- "transfer 500 from cash to gcash" and "move 500 to gcash" (no source)
- "pay my loan on atome with gcash" → Atome debt, GCash, `amount` null
- "pay 1,000 on atome using maribank" → custom amount
- "pay my maribank card with gcash" → MariBank debt, not MariBank account
- "pay my monthly balance with gcash" → `debtId` null, GCash
- "coffee 120" → `transaction`

`npx tsc --noEmit` and `npx expo-doctor` must pass.

## Out of scope
Filtering the picker to "due this month", paying several debts at once, Tagalog phrasing, executing without a confirm tap.
