import type {
  BookDTO,
  PostDTO,
  ShelfSummaryDTO,
  StreamBookRow,
  StreamPostRow,
  StreamShelfRow,
  StreamUnitRow,
  StreamWorkSummary,
} from "@rezics/contract";

export function postHrefForStream(post: PostDTO, realmUnitId?: string | null) {
  if (realmUnitId) return `/realm/${realmUnitId}/post/${post.unitId}`;
  return `/post/${post.unitId}`;
}

function targetUnitForPost(
  post: PostDTO,
  resolved?: StreamWorkSummary | null,
): StreamWorkSummary | null {
  if (!post.targetUnitId) return null;
  if (resolved) return resolved;
  return {
    unitId: post.targetUnitId,
    title: post.extra?.book?.title ?? null,
  };
}

export function mapPostToStreamRow(
  post: PostDTO,
  input: {
    realm?: StreamPostRow["realm"];
    realmUnitId?: string | null;
    reason?: string | null;
    resolvedTargetUnit?: StreamWorkSummary | null;
  } = {},
): StreamPostRow {
  return {
    type: "post",
    rowId: `post:${post.unitId}`,
    post,
    href: postHrefForStream(post, input.realmUnitId),
    contextUnitId: input.realmUnitId ?? null,
    realm: input.realm ?? null,
    targetUnit: targetUnitForPost(post, input.resolvedTargetUnit),
    variantContext: post.variantContext ?? null,
    recommendationReason: input.reason ?? null,
  };
}

function titleFromTranslations(
  source:
    | {
        title?: string | null;
        unit?: { translations?: Array<{ title?: string | null }> };
      }
    | null
    | undefined,
): string | null {
  return (
    source?.title ??
    source?.unit?.translations?.find((translation) => translation.title)
      ?.title ??
    null
  );
}

function firstCreditName(
  credits: BookDTO["creditAttributions"],
): StreamWorkSummary["primaryAuthor"] {
  const credit = credits?.find(
    (item) => item.role === "author" || item.role === "co-author",
  );
  if (!credit?.name) return null;
  return {
    unitId: credit.entityId,
    name: credit.name,
    role: credit.role,
  };
}

export function mapBookToWorkSummary(book: unknown): StreamWorkSummary {
  const source = book as {
    unitId?: string;
    kind?: string | null;
    title?: string | null;
    subtitle?: string | null;
    coverUrl?: string | null;
    summary?: string | null;
    description?: string | null;
    creditAttributions?: BookDTO["creditAttributions"];
    tags?: StreamWorkSummary["tags"];
    unit?: {
      translations?: Array<{
        title?: string | null;
        subtitle?: string | null;
      }>;
    };
  };
  const translation = source.unit?.translations?.find(
    (item) => item.title || item.subtitle,
  );
  return {
    unitId: source.unitId ?? "",
    kind: source.kind ?? "book",
    title: titleFromTranslations(source),
    subtitle: source.subtitle ?? translation?.subtitle ?? null,
    coverUrl: source.coverUrl ?? null,
    description: source.summary ?? source.description ?? null,
    primaryAuthor: firstCreditName(source.creditAttributions),
    tags: source.tags ?? [],
  };
}

export function mapBookToStreamRow(
  book: unknown,
  reason = "stream-book",
): StreamBookRow {
  const summary = mapBookToWorkSummary(book);
  return {
    type: "book",
    rowId: `book:${summary.unitId}`,
    book: summary,
    href: `/book/${summary.unitId}`,
    recommendationReason: reason,
  };
}

function mapShelfToSummary(shelf: unknown): ShelfSummaryDTO {
  const source = shelf as Partial<ShelfSummaryDTO>;
  return {
    unitId: source.unitId ?? "",
    slug: source.slug ?? null,
    userId: source.userId ?? null,
    coverUrl: source.coverUrl ?? null,
    title: source.title ?? null,
    itemCount: source.itemCount ?? 0,
    tags: source.tags,
  };
}

export function mapShelfToStreamRow(
  shelf: unknown,
  reason = "stream-shelf",
): StreamShelfRow {
  const summary = mapShelfToSummary(shelf);
  return {
    type: "shelf",
    rowId: `shelf:${summary.unitId}`,
    shelf: summary,
    href: `/shelf/${summary.unitId}`,
    recommendationReason: reason,
  };
}

export function mapUnitToStreamRow(
  unit: StreamUnitRow["unit"],
  reason = "stream-unit",
): StreamUnitRow {
  return {
    type: "unit",
    rowId: `unit:${unit.unitId}`,
    unit,
    href: hrefForStreamUnit(unit),
    recommendationReason: reason,
  };
}

export function hrefForStreamUnit(unit: StreamUnitRow["unit"]): string {
  if (unit.type === "BOOK") return `/book/${unit.unitId}`;
  if (unit.type === "REALM") {
    return unit.slug ? `/r/${unit.slug}` : `/realm/${unit.unitId}`;
  }
  if (unit.type === "ZONE") {
    return unit.slug ? `/z/${unit.slug}` : `/zone/${unit.unitId}/search`;
  }
  return `/unit/${unit.unitId}`;
}
