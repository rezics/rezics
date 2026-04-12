import type { BookDTO, UnitTranslationDTO } from "@rezics/contract";
import { sanitizeUser } from "@/utils/sanitizeUser";
import type { BookWithRelations } from "./types";

/**
 * Map UnitTranslation to DTO (local helper)
 */
function mapTranslation(
  tr: BookWithRelations["unit"]["translations"][number],
): UnitTranslationDTO {
  return {
    unitId: tr.unitId,
    language: tr.language,
    title: tr.title ?? undefined,
    subtitle: tr.subtitle ?? undefined,
    summary: tr.summary ?? undefined,
    description: tr.description ?? undefined,
    extra: (tr.extra as Record<string, unknown>) ?? undefined,
    sourceReleaseUnitId: tr.sourceReleaseUnitId ?? undefined,
    createdAt: tr.createdAt,
    updatedAt: tr.updatedAt,
  };
}

/**
 * Map internal Book model to BookDTO (base version for list responses)
 */
export function mapBaseBookToDTO(book: BookWithRelations): BookDTO {
  const unit = book.unit;

  return {
    unitId: book.unitId,
    userId: unit.userId,
    user: unit.user ? sanitizeUser(unit.user) : undefined,
    workUnitId: unit.workUnitId ?? undefined,
    status: unit.status,
    visibility: unit.visibility,
    nsfw: unit.nsfw,
    defaultLanguage: unit.defaultLanguage ?? undefined,
    isLanguageNeutral: unit.isLanguageNeutral,

    // Book extension fields
    isbn13: book.isbn13 ?? undefined,
    publicationDate: book.publicationDate ?? undefined,
    pageCount: book.pageCount ?? undefined,
    textLength: book.textLength,
    formatKey: book.formatKey ?? undefined,
    isLicensed: book.isLicensed,
    coverUrl: book.coverUrl ?? undefined,
    extra: (book.extra as Record<string, unknown>) ?? undefined,

    // Translation layer
    translations: unit.translations?.map(mapTranslation) ?? [],

    // Attribution
    personCredits:
      unit.personCredits?.map((pc) => ({
        personId: pc.personId,
        name: pc.person.name,
        roleKey: pc.roleKey,
        sortOrder: pc.sortOrder,
      })) ?? [],
    orgCredits:
      unit.organizationCredits?.map((oc) => ({
        organizationId: oc.organizationId,
        name: oc.organization.name,
        roleKey: oc.roleKey,
        sortOrder: oc.sortOrder,
      })) ?? [],

    // Tags (scored)
    tags:
      unit.unitTags?.map((ut) => {
        // Resolve tag label from first available translation
        const tagTranslation = ut.tag.translations?.[0];
        return {
          tagUnitId: ut.tagUnitId,
          label: tagTranslation?.title ?? undefined,
          score: ut.score,
          voteCount: ut.voteCount,
        };
      }) ?? [],

    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    publishedAt: unit.publishedAt ?? undefined,
  };
}

/**
 * Map internal Book model to BookDTO (full version for single-item responses)
 */
export function mapBookToDTO(book: BookWithRelations): BookDTO {
  return mapBaseBookToDTO(book);
}
