import type { PageDynamicTags } from "@rezics/contract";

export function parseDynamicTagInputTokens(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
    }
  } catch {
    // Fall through to comma/newline parsing.
  }
  return trimmed
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function resolveDynamicTagInputTokens(
  tokens: readonly string[],
  resolveSlug: (token: string) => Promise<string | null>,
): Promise<string[]> {
  const resolved: string[] = [];
  for (const token of tokens) {
    try {
      resolved.push((await resolveSlug(token)) ?? token);
    } catch {
      resolved.push(token);
    }
  }
  return resolved;
}

export function addUniqueDynamicTagUnitIds(
  current: readonly string[],
  added: readonly string[],
): string[] {
  const seen = new Set(current);
  const next = [...current];
  for (const id of added) {
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
}

export function removeDynamicTagOptionAt(
  options: readonly PageDynamicTags["options"][number][],
  index: number,
): PageDynamicTags["options"] {
  return options.filter((_, current) => current !== index);
}
