/**
 * Build query string from filters (generic)
 * Accepts any plain object where values can be primitives, arrays, or objects.
 */
export function buildQueryString(
  // Use a broad type to keep this utility reusable across API domains
  filters?: Record<string, unknown>,
): string {
  if (!filters) return "";

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;

    if (key === "languages" && Array.isArray(value)) {
      params.set(key, value.join(","));
      continue;
    }

    // 如果是对象或数组，序列化为 JSON 字符串
    if (typeof value === "object") {
      params.set(key, JSON.stringify(value));
    } else {
      params.set(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}
