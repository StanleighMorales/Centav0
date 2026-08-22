export type CalcOp = '+' | '-' | '*' | '/';
export type CalcKey = CalcOp | '=' | 'C' | 'back' | '.' | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

export type CalcState = {
  display: string;
  prev: number | null;
  op: CalcOp | null;
  /** next digit starts a fresh entry instead of appending */
  overwrite: boolean;
};

export const initialCalc: CalcState = { display: '0', prev: null, op: null, overwrite: true };

const ERROR = 'Error';
const MAX_DIGITS = 12;

function apply(a: number, b: number, op: CalcOp): number {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '*') return a * b;
  return a / b;
}

// ponytail: trimming at 10dp kills float noise (0.1+0.2) without a decimal library
function show(n: number): string {
  return Number.isFinite(n) ? String(parseFloat(n.toFixed(10))) : ERROR;
}

export function press(state: CalcState, key: CalcKey): CalcState {
  if (state.display === ERROR && key !== 'C') return state;

  if (key === 'C') return initialCalc;

  if (key === 'back') {
    if (state.overwrite) return { ...state, display: '0', overwrite: false };
    const display = state.display.slice(0, -1);
    return { ...state, display: display === '' || display === '-' ? '0' : display, overwrite: false };
  }

  if (key === '.') {
    if (state.overwrite) return { ...state, display: '0.', overwrite: false };
    return state.display.includes('.') ? state : { ...state, display: state.display + '.' };
  }

  if (key === '=') {
    if (state.op === null || state.prev === null) return { ...state, overwrite: true };
    const result = apply(state.prev, parseFloat(state.display), state.op);
    return { display: show(result), prev: null, op: null, overwrite: true };
  }

  if (key === '+' || key === '-' || key === '*' || key === '/') {
    // fold any pending operation first, so 2 + 3 + 4 chains without pressing =
    if (state.op !== null && state.prev !== null && !state.overwrite) {
      const result = apply(state.prev, parseFloat(state.display), state.op);
      if (!Number.isFinite(result)) return { display: ERROR, prev: null, op: null, overwrite: true };
      return { display: show(result), prev: result, op: key, overwrite: true };
    }
    return { ...state, prev: parseFloat(state.display), op: key, overwrite: true };
  }

  const display = state.overwrite || state.display === '0' ? key : state.display + key;
  if (display.replace(/\D/g, '').length > MAX_DIGITS) return state;
  return { ...state, display, overwrite: false };
}

export function pressAll(keys: CalcKey[], state: CalcState = initialCalc): CalcState {
  return keys.reduce(press, state);
}
