import type { TagListEntryDTO } from "@rezics/api/shelf";
import type {
  BookDTO,
  PostDTO,
  PublicUser,
  ShelfDTO,
  ShelfUnitDTO,
  UnitDTO,
  UnitTranslationDTO,
  VariantContextSummary,
} from "@rezics/contract";
import {
  contentDocMarkdownFallback,
  mainMarkdownSource,
  readCoverUrlFromExtra,
} from "@rezics/contract";
import { getTranslation } from "../../shared/utils/translation-helpers";

import { getI18nRuntime } from "@rezics/i18n/runtime";
export type UnitCardAuthor = PublicUser;

export interface UnitCardTranslationMeta {
  language?: string;
  sourceTitle?: string;
  overrideTitle?: string;
}

export interface UnitCardAttachmentCounts {
  reviews: number;
  tags: number;
}

export interface UnitCardSummary {
  unitId: string;
  kind: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  contentPreview?: string;
  author?: UnitCardAuthor | null;
  isCommunityCatalog?: boolean;
  addedAt?: string | Date | null;
  translationMeta?: UnitCardTranslationMeta;
  attachmentCounts?: UnitCardAttachmentCounts;
  variantContext?: VariantContextSummary | null;
}

export interface UnitCardSummaryOptions {
  language?: string;
  addedAt?: string | Date | null;
  fallbackKind?: string;
  fallbackTitle?: string;
}

export interface UnitDtoLike
  extends Partial<
    Pick<
      UnitDTO,
      | "id"
      | "type"
      | "user"
      | "defaultLanguage"
      | "resolvedLanguage"
      | "title"
      | "subtitle"
      | "summary"
      | "description"
      | "translations"
      | "extra"
      | "createdAt"
    >
  > {
  unitId?: string;
  kind?: string;
  coverUrl?: string | null;
}

type TagLike =
  | TagListEntryDTO
  | {
      unitId?: string;
      label?: string | null;
      translations?: { language?: string; title?: string | null }[];
    };

export function unitDtoToUnitCardSummary(
  unit: UnitDtoLike,
  options: UnitCardSummaryOptions = {},
): UnitCardSummary {
  const unitId = text(unit.unitId) ?? text(unit.id) ?? "";
  const translation = getTranslation(
    unit.translations,
    options.language,
    unit.defaultLanguage ?? undefined,
  );
  const title =
    text(unit.title) ??
    text(translation?.title) ??
    text(options.fallbackTitle) ??
    text(unitId) ??
    getI18nRuntime().i18n.t("book:unit_untitled");
  const imageUrl =
    text(unit.coverUrl) ??
    readCoverUrlFromExtra(translation?.extra) ??
    readCoverUrlFromExtra(unit.extra);

  return {
    unitId,
    kind: normalizeKind(options.fallbackKind ?? unit.kind ?? unit.type),
    title,
    subtitle: text(unit.subtitle) ?? text(translation?.subtitle),
    imageUrl: imageUrl ?? null,
    contentPreview:
      text(unit.summary) ??
      contentDocMarkdownFallback(unit.description) ??
      text(translation?.summary) ??
      contentDocMarkdownFallback(translation?.description),
    author: unit.user ?? null,
    isCommunityCatalog: isRezicsWikiUser(unit.user),
    addedAt: options.addedAt ?? null,
    translationMeta:
      unit.resolvedLanguage && !translation
        ? { language: unit.resolvedLanguage }
        : translationToMeta(translation),
  };
}

function isRezicsWikiUser(user: PublicUser | null | undefined): boolean {
  const candidate = user as
    | (PublicUser & { slug?: string | null; userSlug?: string | null })
    | null
    | undefined;
  return (
    candidate?.slug === "rezics-wiki" ||
    candidate?.userSlug === "rezics-wiki" ||
    candidate?.name === "rezics-wiki"
  );
}

export function candidateToUnitCardSummary(
  candidate: {
    kind: string;
    identifier: string;
    identifierType: string;
  },
  unit?: UnitDtoLike,
  options: UnitCardSummaryOptions = {},
): UnitCardSummary {
  if (unit) {
    return unitDtoToUnitCardSummary(unit, {
      ...options,
      fallbackKind: candidate.kind,
      fallbackTitle: candidate.identifier,
    });
  }

  return {
    unitId: candidate.identifier,
    kind: normalizeKind(candidate.kind),
    title: candidate.identifier,
    subtitle: candidate.identifierType,
    imageUrl: null,
    addedAt: options.addedAt ?? null,
  };
}

/**
 * Map a ShelfUnit + its hydrated DTO into a UnitCardSummary.
 */
export function shelfUnitToUnitCardSummary(
  shelfUnit: ShelfUnitDTO,
  data: unknown,
  options: UnitCardSummaryOptions = {},
  attachmentCounts?: UnitCardAttachmentCounts,
): UnitCardSummary {
  const baseOptions: UnitCardSummaryOptions = {
    ...options,
    addedAt: options.addedAt ?? shelfUnit.createdAt ?? null,
    fallbackKind: shelfUnit.kind,
    fallbackTitle: shelfUnit.unitId,
  };

  let summary: UnitCardSummary;

  if (shelfUnit.kind === "book" && isBook(data)) {
    summary = unitDtoToUnitCardSummary(
      {
        unitId: data.unitId,
        type: "book",
        user: data.user,
        defaultLanguage: data.defaultLanguage,
        translations: data.translations,
        coverUrl: data.coverUrl,
        createdAt: data.createdAt,
      },
      baseOptions,
    );
  } else if (
    (shelfUnit.kind === "review" ||
      shelfUnit.kind === "quote" ||
      shelfUnit.kind === "post") &&
    isPost(data)
  ) {
    summary = postToSummary(data, baseOptions);
  } else if (shelfUnit.kind === "shelf" && isShelf(data)) {
    summary = unitDtoToUnitCardSummary(
      {
        unitId: data.unitId,
        type: "shelf",
        user: data.user,
        translations: data.translations,
        coverUrl: data.coverUrl,
        createdAt: data.createdAt,
      },
      baseOptions,
    );
  } else if (shelfUnit.kind === "tag" && isTag(data)) {
    summary = tagToSummary(data, baseOptions);
  } else {
    summary = {
      unitId: shelfUnit.unitId,
      kind: normalizeKind(shelfUnit.kind),
      title: shelfUnit.unitId,
      imageUrl: null,
      addedAt: baseOptions.addedAt,
    };
  }

  return attachSummaryMetadata(
    summary,
    shelfUnit.variantContext,
    attachmentCounts,
  );
}

function attachSummaryMetadata(
  summary: UnitCardSummary,
  variantContext?: VariantContextSummary | null,
  attachmentCounts?: UnitCardAttachmentCounts,
): UnitCardSummary {
  return {
    ...summary,
    ...(variantContext ? { variantContext } : {}),
    ...(attachmentCounts ? { attachmentCounts } : {}),
  };
}

function postToSummary(
  post: PostDTO,
  options: UnitCardSummaryOptions,
): UnitCardSummary {
  const title =
    text(post.title) ??
    firstLine(mainMarkdownSource(post.content)) ??
    text(options.fallbackTitle) ??
    post.unitId;

  return {
    unitId: post.unitId,
    kind: normalizeKind(options.fallbackKind ?? post.kind ?? "post"),
    title,
    imageUrl: null,
    contentPreview: text(mainMarkdownSource(post.content)),
    author: post.author ?? null,
    addedAt: options.addedAt ?? null,
  };
}

function tagToSummary(
  tag: TagLike,
  options: UnitCardSummaryOptions,
): UnitCardSummary {
  const translation =
    tag.translations?.find((item) => item.language === options.language) ??
    tag.translations?.[0];
  const unitId = text(tag.unitId) ?? text(options.fallbackTitle) ?? "tag";

  return {
    unitId,
    kind: "tag",
    title:
      text(translation?.title) ??
      text(tag.label) ??
      text(options.fallbackTitle) ??
      unitId,
    imageUrl: null,
    addedAt: options.addedAt ?? null,
    translationMeta: translation?.language
      ? { language: translation.language }
      : undefined,
  };
}

function translationToMeta(
  translation: UnitTranslationDTO | undefined,
): UnitCardTranslationMeta | undefined {
  if (!translation) return undefined;
  const sourceTitle =
    readExtraText(translation.extra, "sourceTitle") ??
    readExtraText(translation.extra, "originalTitle");
  const overrideTitle =
    readExtraText(translation.extra, "overrideTitle") ??
    readExtraText(translation.extra, "displayTitle");

  if (!translation.language && !sourceTitle && !overrideTitle) {
    return undefined;
  }

  return {
    language: translation.language,
    sourceTitle,
    overrideTitle,
  };
}

function normalizeKind(value: string | null | undefined): string {
  return (text(value) ?? "unit").toLowerCase();
}

function text(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function firstLine(value: string | null | undefined): string | undefined {
  const trimmed = text(value);
  if (!trimmed) return undefined;
  return trimmed.split(/\r?\n/, 1)[0];
}

function readExtraText(extra: unknown, key: string): string | undefined {
  if (!extra || typeof extra !== "object") return undefined;
  const value = (extra as Record<string, unknown>)[key];
  return typeof value === "string" ? text(value) : undefined;
}

function isBook(value: unknown): value is BookDTO {
  return Boolean(value && typeof value === "object" && "coverUrl" in value);
}

function isPost(value: unknown): value is PostDTO {
  return Boolean(value && typeof value === "object" && "authorUserId" in value);
}

function isShelf(value: unknown): value is ShelfDTO {
  return Boolean(value && typeof value === "object" && "itemCount" in value);
}

function isTag(value: unknown): value is TagLike {
  return Boolean(
    value &&
      typeof value === "object" &&
      ("label" in value || "translations" in value),
  );
}
