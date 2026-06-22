// Extract an optional numeric aggregate from an opaque row (Drizzle extras).
// 从不透明行（Drizzle extras）中提取可选数值聚合。
export function optionalCount(row: unknown, key: string): number | undefined {
  const value = (row as Record<string, unknown> | null | undefined)?.[key];
  return typeof value === "number" ? value : undefined;
}
