import {
  type ContentSearchDocument,
  PostKind,
  UnitType,
} from "@rezics/contract";

export function contentHref(item: ContentSearchDocument): string {
  if (item.type === UnitType.BOOK) return `/book/${item.id}`;
  if (item.type === UnitType.SHELF) return `/shelf/${item.id}`;
  if (item.type === UnitType.POST) {
    if (item.postKind === PostKind.REVIEW) return `/review/${item.id}`;
    if (item.postKind === PostKind.EXCERPT) return `/excerpt/${item.id}`;
    if (item.postKind === PostKind.REMARK) return `/remark/${item.id}`;
    return `/post/${item.id}`;
  }
  if (item.type === UnitType.REALM) return `/realm/${item.id}`;
  if (item.type === UnitType.USER) return `/user/${item.id}`;
  if (item.type === UnitType.ENTITY) return `/entity/${item.id}`;
  if (item.type === UnitType.TAG) return `/tag/${item.id}`;
  return `/unit/${item.id}`;
}
