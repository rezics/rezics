/**
 * Build query string from filters (generic)
 * Accepts any plain object where values can be primitives, arrays, or objects.
 * 从过滤器构建查询字符串（通用）
 * 接受任意普通对象，其值可以是原始类型、数组或对象。
 */
export function buildQueryString(
  // Use a broad type to keep this utility reusable across API domains
  // 使用宽泛的类型，使此工具可在各 API 领域间复用
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

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null || item === "") continue;
        params.append(
          key,
          typeof item === "object" ? JSON.stringify(item) : String(item),
        );
      }
      continue;
    }

    if (typeof value === "object") {
      params.set(key, JSON.stringify(value));
    } else {
      params.set(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}
