import type {BookFilters} from '../book/book.types';

/**
 * Build query string from filters
 */
export function buildQueryString(filters?: BookFilters): string {
  if (!filters) return '';

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;

    // 如果是对象或数组，序列化为 JSON 字符串
    if (typeof value === 'object') {
      params.set(key, JSON.stringify(value));
    } else {
      params.set(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}
