import type {
  ZoneBoundary,
  ZoneLinkTarget,
  ZoneMenu,
  ZoneMenuNode,
  ZonePageId,
  ZonePageSummary,
  ZoneRefUnitSummary,
  ZoneSectionKind,
} from "@rezics/contract";
import { ZONE_MENU_MAX_DEPTH } from "@rezics/contract";
import { unitHref } from "@rezics/ui/primitive/link";
import {
  type ZoneDetailKind,
  type ZoneRouteLocation,
  zoneDetailRoute,
  zoneRouteBaseHref,
} from "./zoneDetailRoutes";

export {
  type ZoneRouteLocation,
  zoneManageHref,
  zoneRouteBaseHref,
  zoneRouteLocationFromZone,
  zoneSearchHref,
} from "./zoneDetailRoutes";

export type ZoneRefUnitMap = Record<string, ZoneRefUnitSummary>;

export type ZoneLinkContext = {
  routeLocation: ZoneRouteLocation;
  pages?: readonly ZonePageSummary[];
  refUnits: ZoneRefUnitMap;
};

function normalizeZoneRouteLocation(
  location: ZoneRouteLocation | string,
): ZoneRouteLocation {
  return typeof location === "string"
    ? { kind: "slug", zoneSlug: location }
    : location;
}

/**
 * Zone-framed detail kind from the referenced unit's shape: POST kind WIKI
 * renders through the wiki frame, other POSTs through the post frame,
 * everything else through the generic unit frame.
 * 由被引用 Unit 的形态决定专区框架内的详情类型：kind 为 WIKI 的 POST 走
 * wiki 框架，其他 POST 走 post 框架，其余走通用 unit 框架。
 */
export function zoneDetailKindForRef(
  ref: { type?: string | null; postKind?: string | null } | undefined,
): ZoneDetailKind {
  if (ref?.type !== "POST") return "unit";
  return ref.postKind === "WIKI" ? "wiki" : "post";
}

/**
 * Canonical href for a unit surfaced inside a zone. Posts keep the zone
 * presentation frame because their discussion context matters; catalog units
 * leave the zone and open their product route directly.
 * 专区内浮现的 Unit 的规范 href。帖子保留专区展示框架，因为其讨论语境
 * 重要；目录 Unit 离开专区并直接打开自身产品路由。
 */
export function zoneUnitHref(
  item: {
    unitId: string;
    type?: string | null;
    slug?: string | null;
    postKind?: string | null;
  },
  location: ZoneRouteLocation | string,
): string {
  const routeLocation = normalizeZoneRouteLocation(location);
  if (item.type === "POST") {
    return zoneDetailRoute({
      location: routeLocation,
      kind: zoneDetailKindForRef(item),
      unitId: item.unitId,
    }).href;
  }

  switch (item.type) {
    case "BOOK":
      return `/book/${item.unitId}`;
    case "QUOTE":
      return `/excerpt/${item.unitId}`;
    case "POLL":
      return `/poll/${item.unitId}`;
    case "SHELF":
      return `/shelf/${item.unitId}`;
    case "USER":
    case "REALM":
    case "TAG":
    case "ZONE":
    case "ENTITY":
      return unitHref({
        type: item.type,
        unitId: item.unitId,
        slug: item.slug ?? null,
      });
    default:
      return `/unit/${item.unitId}`;
  }
}

export function zoneSectionItemHref(
  item: {
    unitId: string;
    type?: string | null;
    slug?: string | null;
    postKind?: string | null;
  },
  location: ZoneRouteLocation | string,
): string {
  return zoneUnitHref(item, location);
}

export function zonePageHref(
  pageId: ZonePageId,
  location: ZoneRouteLocation | string,
  pages: readonly ZonePageSummary[] = [],
): string | null {
  const routeLocation = normalizeZoneRouteLocation(location);
  const page = pages.find((candidate) => candidate.id === pageId);
  if (!page) return null;
  return page.slug === "home"
    ? zoneRouteBaseHref(routeLocation)
    : `${zoneRouteBaseHref(routeLocation)}/page/${page.slug}`;
}

export function zoneLinkHref(
  target: ZoneLinkTarget,
  ctx: ZoneLinkContext,
): string | null {
  switch (target.kind) {
    case "unit":
      return zoneUnitHref(
        ctx.refUnits[target.unitId] ?? { unitId: target.unitId },
        ctx.routeLocation,
      );
    case "zonePage":
      return zonePageHref(target.pageId, ctx.routeLocation, ctx.pages);
    case "external":
      return target.url;
  }
}

/**
 * Label resolution chain (zero-inline-text): `labelUnitId` (LABEL unit) →
 * target unit's translated title → `external.text`. Returns null when
 * nothing resolves; callers fall back to `zoneLinkFallbackKey()`.
 * 标签解析链（零内联文本）：`labelUnitId`（LABEL Unit）→ 目标 Unit 的
 * 译文标题 → `external.text`。无法解析时返回 null；调用方回退到
 * `zoneLinkFallbackKey()`。
 */
export function zoneLinkLabel(
  input: { labelUnitId?: string; target?: ZoneLinkTarget },
  refUnits: ZoneRefUnitMap,
): string | null {
  if (input.labelUnitId) {
    const title = refUnits[input.labelUnitId]?.title;
    if (title) return title;
  }
  if (input.target?.kind === "unit") {
    const title = refUnits[input.target.unitId]?.title;
    if (title) return title;
  }
  if (input.target?.kind === "external") return input.target.text;
  return null;
}

/**
 * Frontend i18n fallback for unlabeled zone-page links.
 * 未配置标签的专区页面链接的前端 i18n 回退。
 */
export function zoneLinkFallbackKey(
  target: ZoneLinkTarget | undefined,
): string | null {
  if (target?.kind !== "zonePage") return null;
  return zonePageFallbackKey(target.pageId);
}

const ZONE_PAGE_FALLBACK_KEYS: Record<string, string> = {
  home: "zone:page_home",
  search: "zone:page_search",
  feed: "zone:page_feed",
};

function zonePageFallbackKey(
  pageId: ZonePageId,
  pages: readonly ZonePageSummary[] = [],
): string | null {
  const page = pages.find((candidate) => candidate.id === pageId);
  return ZONE_PAGE_FALLBACK_KEYS[page?.slug ?? pageId] ?? null;
}

export type ResolvedZoneMenuNode = {
  id: string;
  /** Resolved data label; null falls back to `labelKey`. 已解析的数据标签；为 null 时回退到 `labelKey`。 */
  label: string | null;
  labelKey: string | null;
  href: string | null;
  isExternal: boolean;
  children: ResolvedZoneMenuNode[];
};

/**
 * Projects the raw config menu tree into render-ready nodes, clamping at
 * `ZONE_MENU_MAX_DEPTH` (defense in depth — the server validator already
 * rejects deeper trees).
 * 将原始配置菜单树投影为可渲染节点，并按 `ZONE_MENU_MAX_DEPTH` 截断
 * （纵深防御——服务端校验器已拒绝更深的树）。
 */
export function resolveZoneMenuNodes(
  nodes: ZoneMenuNode[],
  ctx: ZoneLinkContext,
  depth = 1,
): ResolvedZoneMenuNode[] {
  if (depth > ZONE_MENU_MAX_DEPTH) return [];
  return nodes.map((node) => ({
    id: node.id,
    label: zoneLinkLabel(node, ctx.refUnits),
    labelKey:
      node.target?.kind === "zonePage"
        ? zonePageFallbackKey(node.target.pageId, ctx.pages)
        : zoneLinkFallbackKey(node.target),
    href: node.target ? zoneLinkHref(node.target, ctx) : null,
    isExternal: node.target?.kind === "external",
    children: resolveZoneMenuNodes(node.children ?? [], ctx, depth + 1),
  }));
}

export function findZoneMenu(
  menus: ZoneMenu[],
  menuId: string,
): ZoneMenu | null {
  return menus.find((menu) => menu.id === menuId) ?? null;
}

export function pickZoneMenu(
  nav: { menus: ZoneMenu[]; header: { menuId: string } },
  menuId?: string | null,
): ZoneMenu | null {
  const explicit = menuId ? findZoneMenu(nav.menus, menuId) : null;
  if (explicit) return explicit;
  return findZoneMenu(nav.menus, nav.header.menuId);
}

// ANCHOR: Section titles
// ANCHOR: 分区标题

const SECTION_TITLE_KEYS: Partial<Record<ZoneSectionKind, string>> = {
  query: "zone:section_title_query",
  collection: "zone:section_title_collection",
  feed: "zone:section_title_feed",
  richText: "zone:section_title_richText",
  stats: "zone:section_title_stats",
  sources: "zone:section_title_sources",
};

/**
 * Section title resolution chain: `titleLabelUnitId` (LABEL unit) →
 * kind-default frontend i18n key (`zoneSectionTitleKey`). Containers and
 * display-only stage chrome have no default title.
 * 分区标题解析链：`titleLabelUnitId`（LABEL Unit）→ 按 kind 的默认前端
 * i18n key（`zoneSectionTitleKey`）。容器与展示型 stage chrome 没有默认标题。
 */
export function zoneSectionTitleText(
  section: { titleLabelUnitId?: string },
  refUnits: ZoneRefUnitMap,
): string | null {
  if (!section.titleLabelUnitId) return null;
  return refUnits[section.titleLabelUnitId]?.title ?? null;
}

export function zoneSectionTitleKey(kind: ZoneSectionKind): string | null {
  return SECTION_TITLE_KEYS[kind] ?? null;
}

// ANCHOR: Realm-context CTA routing
// ANCHOR: Realm 语境 CTA 路由

export function zoneContextRealmSlug(
  boundary: Pick<ZoneBoundary, "context">,
  refUnits: ZoneRefUnitMap,
): string | null {
  if (boundary.context.kind !== "realm") return null;
  return refUnits[boundary.context.realmUnitId]?.slug ?? null;
}

/**
 * Create CTAs stay realm-routed: a realm-context zone's "create wiki/post"
 * deep-links into the context realm's create flow. Global zones have no
 * create target.
 * 创建 CTA 保持 realm 路由：realm 语境专区的「创建 wiki/帖子」深链到
 * 语境 realm 的创建流程。global 专区没有创建目标。
 */
export function zoneCreateHref(
  boundary: Pick<ZoneBoundary, "context">,
  refUnits: ZoneRefUnitMap,
  mode: "wiki" | "post",
): string | null {
  const slug = zoneContextRealmSlug(boundary, refUnits);
  return slug ? `/r/${slug}/create?mode=${mode}` : null;
}

/**
 * Zones are subscribed, never joined: zone grants no rights, so the join
 * CTA deep-links to the context realm page, which hosts the join surface.
 * 专区只能订阅、不能加入：专区不授予权限，因此加入 CTA 深链到承载加入
 * 入口的语境 realm 页面。
 */
export function zoneJoinHref(
  boundary: Pick<ZoneBoundary, "context">,
  refUnits: ZoneRefUnitMap,
): string | null {
  const slug = zoneContextRealmSlug(boundary, refUnits);
  return slug ? `/r/${slug}` : null;
}
