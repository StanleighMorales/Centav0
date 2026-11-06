// ponytail: tiny pub/sub so the tab bar's Add sheet can tell the visible screen to reload — no context/store needed.
const listeners = new Set<() => void>();

export function onDataChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function emitDataChanged(): void {
  listeners.forEach((fn) => fn());
}
