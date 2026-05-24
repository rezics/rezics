import { markdownContentDoc } from "@rezics/contract";
import { Prisma } from "#/prisma/client";

export function markdownContentDocJson(source: string): Prisma.InputJsonValue {
  return markdownContentDoc(source) as Prisma.InputJsonValue;
}

export function nullableContentDocJson(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}
