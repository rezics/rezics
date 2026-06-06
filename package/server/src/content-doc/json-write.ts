import { markdownContentDoc } from "@rezics/contract";

type JsonWriteValue = unknown;

export function markdownContentDocJson(source: string): JsonWriteValue {
  return markdownContentDoc(source);
}

export function nullableContentDocJson(
  value: unknown,
): JsonWriteValue | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value;
}
