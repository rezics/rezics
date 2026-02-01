import {v4 as uuidv4} from 'uuid';

export function generateRandomItemsFrom<T>(source: T[], count: number): T[] {
  const result: T[] = [];
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * source.length);
    const original = source[randomIndex];
    const item = {
      ...original, // 浅拷贝原始对象
      id: uuidv4(), // 覆盖 id
    } as T;
    result.push(item);
  }
  return result;
}

export const EXTERNAL_PAGE_SIZE = 100;

export function secureRandomString(length: number): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);

  return Array.from(array, x => chars[x % chars.length]).join('');
}
