/**
 * Canonical href builder for all routable Unit types. Three tiers:
 * 1. Slug-bearing types: short-prefix slug URL, long-prefix unitId fallback.
 * 2. Shelf with owner context: owner-scoped slug URL, bare /shelf/:id fallback.
 * 3. ID-only types: fixed path prefix + unitId.
 * 所有可路由 Unit 类型的规范 href 构建器。三层：
 * 1. 带 slug 类型：短前缀 slug URL，长前缀 unitId 回退。
 * 2. 带 owner 的书架：owner 作用域 slug URL，裸 /shelf/:id 回退。
 * 3. 纯 ID 类型：固定路径前缀 + unitId。
 */

export type SlugBearingTopType = "USER" | "REALM" | "TAG" | "ZONE" | "ENTITY";

export type IdOnlyType = "BOOK" | "POST" | "QUOTE" | "POLL" | "SHELF";

type SlugBearingTopInput = {
  type: SlugBearingTopType;
  unitId: string;
  slug: string | null | undefined;
};

type SlugBearingShelfInput = {
  type: "SHELF";
  ownerType: "USER" | "REALM";
  ownerSlug: string | null | undefined;
  ownerUnitId: string;
  unitId: string;
  slug: string | null | undefined;
};

type IdOnlyInput = {
  type: IdOnlyType;
  unitId: string;
};

export type UnitHrefInput =
  | SlugBearingTopInput
  | SlugBearingShelfInput
  | IdOnlyInput;

const SHORT_PREFIX: Record<SlugBearingTopType, string> = {
  USER: "u",
  REALM: "r",
  TAG: "t",
  ZONE: "z",
  ENTITY: "e",
};

const LONG_PREFIX: Record<SlugBearingTopType, string> = {
  USER: "user",
  REALM: "realm",
  TAG: "tag",
  ZONE: "zone",
  ENTITY: "entity",
};

const ID_ONLY_PREFIX: Record<IdOnlyType, string> = {
  BOOK: "book",
  POST: "post",
  QUOTE: "excerpt",
  POLL: "poll",
  SHELF: "shelf",
};

const SHELF_OWNER_SHORT: Record<SlugBearingShelfInput["ownerType"], string> = {
  USER: "u",
  REALM: "r",
};

/**
 * Loose dispatcher: accept a flat { type, unitId, slug? } and route to the
 * correct `unitHref` overload. Falls back to `/unit/:unitId` for unknown types.
 * 宽松调度：接受扁平 { type, unitId, slug? }，按 type 路由到正确的
 * unitHref 重载。未知类型回退到 `/unit/:unitId`。
 */
export function unitHrefFromPartial(
  type: string,
  unitId: string,
  slug?: string | null,
): string {
  if (type in ID_ONLY_PREFIX)
    return unitHref({ type: type as IdOnlyType, unitId });
  if (type in SHORT_PREFIX)
    return unitHref({ type: type as SlugBearingTopType, unitId, slug });
  return `/unit/${unitId}`;
}

export function unitHref(input: UnitHrefInput): string {
  // Rich shelf with owner context
  // 带 owner 上下文的书架路由
  if (input.type === "SHELF" && "ownerType" in input) {
    const shelf = input as SlugBearingShelfInput;
    const ownerPrefix = SHELF_OWNER_SHORT[shelf.ownerType];
    if (shelf.ownerSlug && shelf.slug) {
      return `/${ownerPrefix}/${shelf.ownerSlug}/shelf/${shelf.slug}`;
    }
    return `/shelf/${shelf.unitId}`;
  }

  // ID-only types (BOOK, POST, QUOTE, POLL, bare SHELF)
  // 纯 ID 类型（BOOK、POST、QUOTE、POLL、裸 SHELF）
  const idPrefix = ID_ONLY_PREFIX[input.type as IdOnlyType];
  if (idPrefix) {
    return `/${idPrefix}/${input.unitId}`;
  }

  // Slug-bearing types — short prefix with slug, long prefix with unitId
  // 带 slug 类型 —— 有 slug 用短前缀，否则用长前缀 + unitId
  const top = input as SlugBearingTopInput;
  if (top.slug) {
    return `/${SHORT_PREFIX[top.type]}/${top.slug}`;
  }
  return `/${LONG_PREFIX[top.type]}/${top.unitId}`;
}
