export function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;

  if (typeof value === "string") {
    if (value === "null") return true;
    if (value === "undefined") return true;
    return value.trim().length === 0;
  }

  if (typeof value === "number") {
    // NaN or ±Infinity counts as empty.
    // NaN 或 ±Infinity 算空。
    return !Number.isFinite(value);
  }

  if (typeof value === "boolean") {
    // Booleans are never empty (both true and false are valid values).
    // 布尔值永远不算空（true/false 都是有效值）。
    return false;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === "object") {
    return Object.keys(value as object).length === 0;
  }

  // Other types (symbol, bigint, etc.) are treated as having a value.
  // 其他类型（symbol、bigint 等），按有值处理。
  return false;
}

// Safe toString; empty values return ''.
// 安全 toString，空值返回 ''。
export function safeToString(value: unknown): string {
  return isEmptyValue(value) ? "" : String(value);
}
