import type { ContentSearchDocument } from "@rezics/contract";

export function contentHref(item: ContentSearchDocument): string {
  if (item.type === "BOOK") return `/book/${item.id}`;
  if (item.type === "SHELF") return `/shelf/${item.id}`;
  if (item.type === "POST") {
    if (item.postKind === "REVIEW") return `/review/${item.id}`;
    if (item.postKind === "EXCERPT") return `/excerpt/${item.id}`;
    if (item.postKind === "REMARK") return `/remark/${item.id}`;
    return `/post/${item.id}`;
  }
  if (item.type === "REALM") return `/realm/${item.id}`;
  if (item.type === "USER") return `/user/${item.id}`;
  if (item.type === "ENTITY") return `/entity/${item.id}`;
  if (item.type === "TAG") return `/tag/${item.id}`;
  return `/unit/${item.id}`;
}
