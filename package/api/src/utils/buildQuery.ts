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
