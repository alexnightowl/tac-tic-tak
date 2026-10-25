/**
 * Describes a JSON value by structure only, so golden snapshots freeze
 * the contract (keys + value kinds) without freezing volatile values
 * like ids, timestamps or random puzzle picks.
 *
 *   {a: 1, b: [{x: 'y'}], c: null}  ->  {a: 'number', b: [{x: 'string'}], c: 'null'}
 *
 * Arrays collapse to the sorted set of distinct element shapes
 * (`[]` when empty), so a list of N similar rows reads as one row.
 */
export type Shape = string | Shape[] | { [k: string]: Shape };

export function shapeOf(v: unknown): Shape {
  if (v === null) return 'null';
  if (Array.isArray(v)) {
    const seen = new Map<string, Shape>();
    for (const el of v) {
      const s = shapeOf(el);
      seen.set(JSON.stringify(s), s);
    }
    return [...seen.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, s]) => s);
  }
  if (typeof v === 'object') {
    const out: { [k: string]: Shape } = {};
    for (const k of Object.keys(v as object).sort()) out[k] = shapeOf((v as Record<string, unknown>)[k]);
    return out;
  }
  return typeof v;
}

/** Top-level key set only (sorted). */
export function keysOf(v: unknown): string[] {
  return v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort() : [];
}
