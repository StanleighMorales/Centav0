// Self-check for calc.ts. No test framework in this repo — run it directly:
//   node --experimental-strip-types src/utils/calc.check.mts
// ponytail: .mts keeps it out of `tsc --noEmit` (no @types/node needed) and out of the app bundle.
import assert from 'node:assert';
import { pressAll, type CalcKey } from './calc.ts';

const shows = (keys: CalcKey[], expected: string) =>
  assert.strictEqual(pressAll(keys).display, expected, keys.join(' '));

shows(['1', '2', '+', '3', '='], '15');
shows(['2', '+', '3', '+'], '5'); // chains without pressing =
shows(['2', '+', '3', '+', '4', '='], '9');
shows(['1', '0', '-', '2', '5', '='], '-15');
shows(['0', '.', '1', '+', '0', '.', '2', '='], '0.3'); // no float noise
shows(['5', '.', '.', '5'], '5.5'); // one decimal point only
shows(['7', '/', '0', '='], 'Error');
shows(['7', '/', '0', '=', '9'], 'Error'); // error sticks until C
shows(['7', '/', '0', '=', 'C', '9'], '9');
shows(['1', '2', '3', 'back'], '12');
shows(['9', 'back'], '0');
shows(['2', '+', '3', '=', '4'], '4'); // result is overwritten, not appended
shows(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1', '2', '3'], '123456789012'); // 12-digit cap

console.log('calc.ts: all checks passed');
