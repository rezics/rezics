export function isEmptyValue(value: unknown): boolean {
  // null / undefined
  if (value == null) return true;

  // 字符串
  if (typeof value === "string") {
    if (value === "null") return true;
    if (value === "undefined") return true;
    return value.trim().length === 0;
  }

  // 数字
  if (typeof value === "number") {
    // NaN 或 ±Infinity 算空
    return !Number.isFinite(value);
  }

  // 布尔
  if (typeof value === "boolean") {
    // 布尔值永远不算空（true/false 都是有效值）
    return false;
  }

  // 数组
  if (Array.isArray(value)) {
    return value.length === 0;
  }

  // 对象
  if (typeof value === "object") {
    return Object.keys(value as object).length === 0;
  }

  // 其他类型（symbol、bigint等），按有值处理
  return false;
}

// 安全 toString，空值返回 ''
export function safeToString(value: unknown): string {
  return isEmptyValue(value) ? "" : String(value);
}
