import { v4 as uuidv4 } from "uuid";

export function pickRandom<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  const n = Math.min(count, copy.length);

  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy[idx]);
    copy.splice(idx, 1); // Remove the picked item — 移除已选项
  }
  return result;
}

export function pickRandomAllowRepeat<T>(arr: T[], count: number): T[] {
  const result: T[] = [];
  if (arr.length === 0) return result;

  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * arr.length);
    let item = arr[idx];
    item = { ...item, id: uuidv4() } as T;
    result.push(item); // Don't remove, allow repeats — 不删除，允许重复
  }
  return result;
}
