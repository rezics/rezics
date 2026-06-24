import type {
  BookDTO,
  PostDTO,
  ShelfDTO,
  StreamBookRow,
  StreamPostRow,
  StreamShelfRow,
  StreamUnitRow,
  UnitDTO,
} from "@rezics/contract";

export function postHrefForStream(post: PostDTO, realmUnitId?: string | null) {
  if (realmUnitId) return `/realm/${realmUnitId}/post/${post.unitId}`;
  return `/post/${post.unitId}`;
}

export function mapPostToStreamRow(
  post: PostDTO,
  input: {
    realmUnitId?: string | null;
    reason?: string | null;
  } = {},
): StreamPostRow {
  return {
    type: "post",
    rowId: `post:${post.unitId}`,
    post,
    href: postHrefForStream(post, input.realmUnitId),
    contextUnitId: input.realmUnitId ?? null,
    recommendationReason: input.reason ?? null,
  };
}

export function mapBookToStreamRow(
  book: BookDTO,
  reason = "stream-book",
): StreamBookRow {
  return {
    type: "book",
    rowId: `book:${book.unitId}`,
    book,
    href: `/book/${book.unitId}`,
    recommendationReason: reason,
  };
}

export function mapShelfToStreamRow(
  shelf: ShelfDTO,
  reason = "stream-shelf",
): StreamShelfRow {
  return {
    type: "shelf",
    rowId: `shelf:${shelf.unitId}`,
    shelf,
    href: `/shelf/${shelf.unitId}`,
    recommendationReason: reason,
  };
}

export function mapUnitToStreamRow(
  unit: UnitDTO,
  reason = "stream-unit",
): StreamUnitRow {
  return {
    type: "unit",
    rowId: `unit:${unit.id}`,
    unit,
    href: hrefForStreamUnit(unit),
    recommendationReason: reason,
  };
}

export function hrefForStreamUnit(unit: UnitDTO): string {
  if (unit.type === "BOOK") return `/book/${unit.id}`;
  if (unit.type === "REALM") {
    return unit.slug ? `/r/${unit.slug}` : `/realm/${unit.id}`;
  }
  if (unit.type === "ZONE") {
    return unit.slug ? `/z/${unit.slug}` : `/zone/${unit.id}/search`;
  }
  return `/unit/${unit.id}`;
}
