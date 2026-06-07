export type DatabaseErrorDetails = {
  code: string;
  table?: string;
  column?: string;
  constraint?: string;
};

function readStringField(error: unknown, field: string): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
}

export function readDatabaseErrorDetails(
  error: unknown,
): DatabaseErrorDetails | null {
  const cause =
    error && typeof error === "object"
      ? (error as { cause?: unknown }).cause
      : undefined;
  const source = readStringField(cause, "code") ? cause : error;
  const code = readStringField(source, "code");
  if (!code) return null;

  const table = readStringField(source, "table");
  const column = readStringField(source, "column");
  const constraint = readStringField(source, "constraint");

  return {
    code,
    ...(table ? { table } : {}),
    ...(column ? { column } : {}),
    ...(constraint ? { constraint } : {}),
  };
}
