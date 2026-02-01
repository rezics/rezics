// Shared mock utilities: parsing, pagination, id generation

export const toInt = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const safeString = (v: unknown, fallback = ''): string =>
  v === undefined || v === null ? fallback : String(v);

// Allow 0, clamp to >= 0
export const toNonNegativeInt = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function paginateOffset<T>(list: T[], offset: number, limit: number) {
  const totalItems = list.length;
  const safeOffset = Math.max(0, Number.isFinite(offset) ? offset : 0);
  const safeLimit = Math.max(0, Number.isFinite(limit) ? limit : 0);
  const items = list.slice(safeOffset, safeOffset + safeLimit);
  return {items, offset: safeOffset, totalItems};
}

export function pickRandom<T>(source: readonly T[], limit: number): T[] {
  const arr = Array.isArray(source) ? [...source] : [];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, limit);
}
