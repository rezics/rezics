// 小工具：统一放这里，避免散落在 handler 里

export const toInt = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const safeString = (v: unknown, fallback = ""): string =>
  v === undefined || v === null ? fallback : String(v);

// 与 toInt 不同：允许 0，且下限为 0
export const toNonNegativeInt = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

// 简单 ID 生成（在 mock 环境够用；生产可换成 uuidv7）
export function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// 旧的基于 page 的分页方法（保留以兼容历史调用）
export function paginate<T>(list: T[], page: number, limit: number) {
  const totalItems = list.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, limit)));
  const start = (page - 1) * limit;
  const items = list.slice(start, start + limit);
  return { items, page, totalItems, totalPages };
}

// 新的 offset + limit 规范
export function paginateOffset<T>(list: T[], offset: number, limit: number) {
  const totalItems = list.length;
  const safeOffset = Math.max(0, Number.isFinite(offset) ? offset : 0);
  const safeLimit = Math.max(0, Number.isFinite(limit) ? limit : 0);
  const items = list.slice(safeOffset, safeOffset + safeLimit);
  return { items, offset: safeOffset, totalItems };
}

// 从一组候选里“抽样”N 个（无重复、数量不足则全部返回）
export function pickRandom<T>(source: readonly T[], limit: number): T[] {
  const arr = Array.isArray(source) ? [...source] : [];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, limit);
}
