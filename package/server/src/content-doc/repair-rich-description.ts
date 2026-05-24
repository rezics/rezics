import { markdownContentDoc, type ContentDoc } from "@rezics/contract";

export function repairRichDescriptionValue(
  value: unknown,
): ContentDoc | null | unknown {
  if (typeof value !== "string") return value;
  if (value.trim() === "") return null;
  return markdownContentDoc(value);
}
