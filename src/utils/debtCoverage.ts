/** How much more the user still needs, after available funds and expected income are applied against what's due. Never negative. */
export function stillNeeded(totalDue: number, availableFunds: number, expectedIncome: number): number {
  return Math.max(0, totalDue - availableFunds - expectedIncome);
}
