import type {
  Language,
  ShelfDetailDTO,
  ShelfDTO,
  ShelfItemDTO,
  ShelfItemKind,
  ShelfItemParentRole,
  ShelfItemType,
  ShelfMatchedUnitDTO,
  ShelfSummaryDTO,
  SupportLanguageLike,
  UnitTranslationDTO,
} from "@rezics/contract";
import { readCoverUrlFromExtra, resolveReadLanguage } from "@rezics/contract";
import type { EffectiveReadLanguageInput } from "@/unit/language-resolution";
import { resolveStoredLicenseSlug } from "../unit/publication-policy";
import { mapPublicUser } from "../utils/sanitizeUser";
import type {
  ShelfItemRow,
  ShelfListSelected,
  ShelfWithMetadata,
} from "./types";

type ShelfTranslationLike = {
  language: string;
  extra: unknown;
  title?: string | null;
  description?: unknown;
};

type ShelfDisplayInput = {
  defaultLanguage?: string | null;
  supportLanguages?: readonly SupportLanguageLike[] | null;
  translations?: readonly ShelfTranslationLike[] | null;
};

function normalizeReadLanguageInput(
  readLanguage: EffectiveReadLanguageInput | readonly string[],
): EffectiveReadLanguageInput {
  return Array.isArray(readLanguage)
    ? { languages: readLanguage as readonly string[] }
    : (readLanguage as EffectiveReadLanguageInput);
}

/**
 * Resolve shelf display at the language-row level, not per field.
 *
 * Shelf has no stored title/description/cover fields. These are display fields
 * derived from the selected UnitTranslation row. Once a language is selected,
 * missing fields intentionally remain missing instead of falling back to a
 * different language.
 *
 * 按“语言行”解析书架展示字段，而不是按字段逐个回退。
 *
 * Shelf 不存储 title/description/cover；这些都是从选中的 UnitTranslation
 * 行派生的展示字段。一旦选定语言，该语言缺失的字段会如实保持缺失，
 * 不跨语言补洞。
 */
function resolveShelfDisplay(
  input: ShelfDisplayInput,
  readLanguage: EffectiveReadLanguageInput | readonly string[] = {},
): {
  resolvedLanguage: Language | null;
  translation: ShelfTranslationLike | undefined;
} {
  const translations = input.translations ?? [];
  const readInput = normalizeReadLanguageInput(readLanguage);
  const resolvedLanguage = resolveReadLanguage({
    explicitLanguage: readInput.explicitLanguage,
    languages: readInput.languages,
    preferredLanguages: readInput.preferredLanguages,
    appLocale: readInput.appLocale,
    supportLanguages: input.supportLanguages,
    availableLanguages: translations.map((item) => item.language),
    fallbackLanguage: input.defaultLanguage,
  });
  const translation = resolvedLanguage
    ? translations.find((item) => item.language === resolvedLanguage)
    : undefined;
  return {
    resolvedLanguage: (resolvedLanguage as Language | null) ?? null,
    translation,
  };
}

function mapTranslation(
  tr: ShelfTranslationLike & {
    unitId?: string;
    subtitle?: string | null;
    summary?: string | null;
    sourceUnitId?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  },
): UnitTranslationDTO {
  return {
    unitId: tr.unitId ?? "",
    language: tr.language as Language,
    title: tr.title ?? undefined,
    subtitle: tr.subtitle ?? undefined,
    summary: tr.summary ?? undefined,
    description: tr.description as UnitTranslationDTO["description"],
    extra: (tr.extra as Record<string, unknown>) ?? undefined,
    sourceUnitId: tr.sourceUnitId ?? undefined,
    createdAt: tr.createdAt,
    updatedAt: tr.updatedAt,
  };
}

export function mapShelfItemToDTO(row: ShelfItemRow): ShelfItemDTO {
  const itemType = row.itemType as ShelfItemType;
  return {
    shelfId: row.shelfId,
    itemType,
    itemId: row.itemId,
    kind: row.kind as ShelfItemKind,
    parentItemType: (row.parentItemType as ShelfItemType | null) ?? null,
    parentItemId: row.parentItemId ?? null,
    parentRole: (row.parentRole as ShelfItemParentRole | null) ?? null,
    position: row.position,
    searchText: row.searchText ?? null,
    createdByUserId: row.createdByUserId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapShelfToDTO(
  row: ShelfWithMetadata,
  readLanguage: EffectiveReadLanguageInput | readonly string[] = {},
): ShelfDTO {
  const display = resolveShelfDisplay(
    {
      defaultLanguage: row.unit?.defaultLanguage,
      supportLanguages: row.unit?.supportLanguages,
      translations: row.unit?.translations,
    },
    readLanguage,
  );
  return {
    unitId: row.unitId,
    slug: row.unit?.slug ?? undefined,
    userId: row.unit?.userId ?? undefined,
    user: mapPublicUser(row.unit?.user),
    status: row.unit?.status,
    visibility: row.unit?.visibility,
    licenseSlug: resolveStoredLicenseSlug(row.unit?.licenseSlug),
    defaultLanguage: (row.unit?.defaultLanguage as Language | null) ?? null,
    resolvedLanguage: display.resolvedLanguage,
    title: display.translation?.title ?? null,
    description:
      (display.translation?.description as ShelfDTO["description"]) ?? null,
    coverUrl: readCoverUrlFromExtra(display.translation?.extra) ?? null,
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    rootItemCount: row.rootItemCount,
    itemCount: row.itemCount,
    translations: (row.unit?.translations ?? []).map(mapTranslation),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapShelfDetailToDTO(
  row: ShelfWithMetadata,
  itemCount: number,
  readLanguage: EffectiveReadLanguageInput | readonly string[] = {},
): ShelfDetailDTO {
  return {
    ...mapShelfToDTO(row, readLanguage),
    itemCount,
    tags: row.unit?.unitTags
      ?.filter((t) => t.pinned)
      .map((t) => ({
        tagUnitId: t.tagUnitId,
        score: t.score,
      })),
  };
}

export function mapShelfListRowToDTO(
  row: ShelfListSelected,
  matchedUnit?: ShelfMatchedUnitDTO | null,
  readLanguage: EffectiveReadLanguageInput | readonly string[] = {},
): ShelfDTO {
  const display = resolveShelfDisplay(
    {
      defaultLanguage: row.unit?.defaultLanguage,
      supportLanguages: row.unit?.supportLanguages,
      translations: row.unit?.translations,
    },
    readLanguage,
  );
  return {
    unitId: row.unitId,
    slug: row.unit?.slug ?? undefined,
    userId: row.unit?.userId ?? undefined,
    user: mapPublicUser(row.unit?.user),
    status: row.unit?.status,
    visibility: row.unit?.visibility,
    licenseSlug: resolveStoredLicenseSlug(row.unit?.licenseSlug),
    defaultLanguage: (row.unit?.defaultLanguage as Language | null) ?? null,
    resolvedLanguage: display.resolvedLanguage,
    title: display.translation?.title ?? null,
    description:
      (display.translation?.description as ShelfDTO["description"]) ?? null,
    coverUrl: readCoverUrlFromExtra(display.translation?.extra) ?? null,
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    rootItemCount: row.rootItemCount,
    itemCount: row.itemCount,
    matchedUnit: matchedUnit ?? undefined,
    translations: (row.unit?.translations ?? []).map(mapTranslation),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapShelfSummaryToDTO(
  row: ShelfListSelected,
  readLanguage: EffectiveReadLanguageInput | readonly string[] = {},
): ShelfSummaryDTO {
  const display = resolveShelfDisplay(
    {
      defaultLanguage: row.unit?.defaultLanguage,
      supportLanguages: row.unit?.supportLanguages,
      translations: row.unit?.translations,
    },
    readLanguage,
  );
  return {
    unitId: row.unitId,
    slug: row.unit?.slug ?? undefined,
    userId: row.unit?.userId ?? undefined,
    defaultLanguage: (row.unit?.defaultLanguage as Language | null) ?? null,
    resolvedLanguage: display.resolvedLanguage,
    coverUrl: readCoverUrlFromExtra(display.translation?.extra) ?? null,
    title: display.translation?.title ?? null,
    itemCount: row.itemCount,
    tags: row.unit?.unitTags
      ?.filter((t) => t.pinned)
      .map((t) => ({
        tagUnitId: t.tagUnitId,
        score: t.score,
      })),
  };
}
