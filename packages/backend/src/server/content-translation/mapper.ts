import type { ContentTranslationDTO } from "@rezics/contract";
import type { ContentTranslationRow } from "./types";

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export function mapContentTranslationToDTO(
  row: ContentTranslationRow,
): ContentTranslationDTO {
  return {
    unitId: row.unitId,
    language: row.language as ContentTranslationDTO["language"],
    content: row.content as ContentTranslationDTO["content"],
    status: row.status as ContentTranslationDTO["status"],
    sourceUnitId: row.sourceUnitId ?? null,
    authorUserId: row.authorUserId ?? null,
    provenance: row.provenance as ContentTranslationDTO["provenance"],
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}
