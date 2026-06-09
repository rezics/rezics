export function formatJsonDraft(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

export function parseJsonDraft<T>(label: string, value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new Error(`${label} must be valid JSON: ${message}`);
  }
}

export function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
