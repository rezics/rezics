import type { TagListEntryDTO } from "@rezics/api/shelf";
import type {
  BookDTO,
  PostDTO,
  PublicUser,
  ShelfDTO,
  ShelfItemDTO,
  UnitDTO,
  UnitTranslationDTO,
} from "@rezics/contract";
import { readCoverUrlFromExtra } from "@rezics/contract";
import { getTranslation } from "../../shared/utils/translation-helpers";

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
  addedAt?: string | Date | null;
  translationMeta?: UnitCardTranslationMeta;
  attachmentCounts?: UnitCardAttachmentCounts;
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
      | "workUnitId"
      | "defaultLanguage"
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

export type HydratedShelfEntryLike =
  | {
      kind: "prime";
      enriched: {
        item: ShelfItemDTO;
        primary: unknown;
        attachedReviews?: readonly unknown[];
        attachedTags?: readonly unknown[];
      };
    }
  | {
      kind: "review";
      parentItem: ShelfItemDTO;
      review: PostDTO;
    }
  | {
      kind: "tag";
      parentItem: ShelfItemDTO;
      tag: TagLike;
    };

export interface UnitWorkContext {
  unitId: string;
  title?: string;
}

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
    text(translation?.title) ??
    text(options.fallbackTitle) ??
    text(unitId) ??
    "Untitled unit";
  const imageUrl =
    text(unit.coverUrl) ??
    readCoverUrlFromExtra(translation?.extra) ??
    readCoverUrlFromExtra(unit.extra);

  return {
    unitId,
    kind: normalizeKind(options.fallbackKind ?? unit.kind ?? unit.type),
    title,
    subtitle: text(translation?.subtitle),
    imageUrl: imageUrl ?? null,
    contentPreview:
      text(translation?.summary) ?? text(translation?.description),
    author: unit.user ?? null,
    addedAt: options.addedAt ?? null,
    translationMeta: translationToMeta(translation),
  };
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

export function shelfEntryToUnitCardSummary(
  entry: HydratedShelfEntryLike,
  options: UnitCardSummaryOptions = {},
): UnitCardSummary {
  if (entry.kind === "review") {
    return postToSummary(entry.review, {
      ...options,
      addedAt: options.addedAt ?? entry.parentItem.createdAt ?? null,
      fallbackKind: "review",
      fallbackTitle: entry.parentItem.itemRef,
    });
  }

  if (entry.kind === "tag") {
    return tagToSummary(entry.tag, {
      ...options,
      addedAt: options.addedAt ?? entry.parentItem.createdAt ?? null,
      fallbackTitle: entry.parentItem.itemRef,
    });
  }

  const attachmentCounts = pickAttachmentCounts(
    entry.enriched.attachedReviews?.length ?? 0,
    entry.enriched.attachedTags?.length ?? 0,
  );
  return withAttachmentCounts(primeSummary(entry, options), attachmentCounts);
}

function primeSummary(
  entry: Extract<HydratedShelfEntryLike, { kind: "prime" }>,
  options: UnitCardSummaryOptions,
): UnitCardSummary {
  const { item, primary } = entry.enriched;
  const baseOptions = {
    ...options,
    addedAt: options.addedAt ?? item.createdAt ?? null,
    fallbackKind: item.kind,
    fallbackTitle: item.itemRef,
  };

  if (item.kind === "book" && isBook(primary)) {
    return unitDtoToUnitCardSummary(
      {
        unitId: primary.unitId,
        type: "book",
        user: primary.user,
        defaultLanguage: primary.defaultLanguage,
        translations: primary.translations,
        coverUrl: primary.coverUrl,
        createdAt: primary.createdAt,
      },
      baseOptions,
    );
  }

  if (
    (item.kind === "review" || item.kind === "quote" || item.kind === "post") &&
    isPost(primary)
  ) {
    return postToSummary(primary, baseOptions);
  }

  if (item.kind === "shelf" && isShelf(primary)) {
    return unitDtoToUnitCardSummary(
      {
        unitId: primary.unitId,
        type: "shelf",
        user: primary.user,
        translations: primary.translations,
        coverUrl: primary.coverUrl,
        createdAt: primary.createdAt,
      },
      baseOptions,
    );
  }

  if (item.kind === "tag" && isTag(primary)) {
    return tagToSummary(primary, baseOptions);
  }

  return {
    unitId: item.itemRef,
    kind: normalizeKind(item.kind),
    title: item.itemRef,
    imageUrl: null,
    addedAt: baseOptions.addedAt,
  };
}

function pickAttachmentCounts(
  reviews: number,
  tags: number,
): UnitCardAttachmentCounts | undefined {
  if (reviews <= 0 && tags <= 0) return undefined;
  return { reviews, tags };
}

function withAttachmentCounts(
  summary: UnitCardSummary,
  attachmentCounts: UnitCardAttachmentCounts | undefined,
): UnitCardSummary {
  if (!attachmentCounts) return summary;
  return { ...summary, attachmentCounts };
}

export function resolveUnitWorkContext(
  candidate: { kind: string; identifier: string } | undefined,
  unit?: UnitDtoLike,
): UnitWorkContext | undefined {
  const title = unit
    ? unitDtoToUnitCardSummary(unit, {
        fallbackKind: candidate?.kind,
        fallbackTitle: candidate?.identifier,
      }).title
    : undefined;

  if (text(unit?.workUnitId)) {
    return { unitId: unit!.workUnitId!, title };
  }

  const unitId =
    text(unit?.unitId) ?? text(unit?.id) ?? text(candidate?.identifier);
  if (!unitId) return undefined;

  const type = normalizeKind(unit?.type ?? candidate?.kind);
  if (type === "book" || type === "game" || type === "media") {
    return { unitId, title };
  }

  return undefined;
}

function postToSummary(
  post: PostDTO,
  options: UnitCardSummaryOptions,
): UnitCardSummary {
  const title =
    text(post.extra?.title) ??
    firstLine(post.body) ??
    text(options.fallbackTitle) ??
    post.unitId;

  return {
    unitId: post.unitId,
    kind: normalizeKind(options.fallbackKind ?? post.kind ?? "post"),
    title,
    imageUrl: null,
    contentPreview: text(post.body),
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
