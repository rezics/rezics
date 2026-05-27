const REDACTED = "[REDACTED]";

const DEFAULT_SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-internal-secret",
  "x-internal-auth-token",
  "x-internal-token",
  "secret",
  "token",
  "password",
  "api-key",
  "apikey",
]);

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    DEFAULT_SENSITIVE_KEYS.has(normalized) ||
    normalized.endsWith("_secret") ||
    normalized.endsWith("_token") ||
    normalized.endsWith("_password") ||
    normalized.includes("authorization")
  );
}

export function redactSensitiveFields<T>(value: T): T {
  if (!value || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveFields(item)) as T;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    redacted[key] = isSensitiveKey(key)
      ? REDACTED
      : redactSensitiveFields(fieldValue);
  }

  return redacted as T;
}

export function headersToRedactedRecord(
  headers: Headers,
): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    record[key] = isSensitiveKey(key) ? REDACTED : value;
  }
  return record;
}
