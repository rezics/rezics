import type {
  ContentLanguage,
  Language,
  ZoneBoundary,
  ZoneDynamicTags,
  ZoneMenuNode,
  ZoneNav,
  ZonePage,
  ZonePageSection,
  ZoneSectionQuery,
  ZoneSectionQueryFilterField,
  ZoneSectionQuerySortField,
  ZoneTheme,
  ZoneTranslation,
} from "@rezics/contract";
import {
  CONTENT_LANGUAGE_SLUGS,
  ZONE_BOUNDARY_SCHEMA,
  ZONE_BOUNDARY_V1_VERSION,
  ZONE_MENU_MAX_DEPTH,
  ZONE_NAV_SCHEMA,
  ZONE_NAV_V1_VERSION,
  ZONE_PAGE_SCHEMA,
  ZONE_PAGE_V1_VERSION,
  ZONE_SECTION_QUERY_FILTERABLE_FIELDS,
  ZONE_SECTION_QUERY_SORT_FIELDS,
  ZONE_THEME_SCHEMA,
  ZONE_THEME_V1_VERSION,
  zoneBoundaryV1Schema,
  zoneNavV1Schema,
  zonePageV1Schema,
  zoneThemeV1Schema,
} from "@rezics/contract";
import { Value } from "@sinclair/typebox/value";

// ANCHOR: Zone manage draft
// ANCHOR: 专区管理草稿

/**
 * The manage editors operate on the config envelope body (everything except
 * the `schema`/`version` literals). Draft → envelope must be an identity
 * round-trip: the editors never normalize or re-shape what the server
 * already validated.
 * 管理编辑器操作配置信封的主体（除 `schema`/`version` 字面量之外的全部
 * 内容）。草稿 → 信封必须是恒等往返：编辑器绝不归一化或改写服务端已
 * 校验过的内容。
 */
export type ZonePageId = string;
export type ZonePages = Record<string, { sections: ZonePageSection[] }>;

export type ZoneManageDraft = Omit<ZoneBoundary, "schema" | "version"> &
  Omit<ZoneNav, "schema" | "version"> & {
    theme: Omit<ZoneTheme, "schema" | "version">;
    pages: ZonePages;
  };

export type ZoneManageJsonTarget =
  | { kind: "boundary" }
  | { kind: "nav" }
  | { kind: "theme" }
  | { kind: "page"; pageId: ZonePageId };

export type ZoneManageJsonProblem = {
  path: string;
  message: string;
};

function deepClone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

export function zoneShellToDraft(input: {
  boundary: ZoneBoundary;
  nav: ZoneNav;
  theme: ZoneTheme;
  page?: ZonePage;
  pageId?: ZonePageId;
}): ZoneManageDraft {
  const {
    schema: _boundarySchema,
    version: _boundaryVersion,
    ...boundary
  } = input.boundary;
  const { schema: _navSchema, version: _navVersion, ...nav } = input.nav;
  const {
    schema: _themeSchema,
    version: _themeVersion,
    ...theme
  } = input.theme;
  return deepClone({
    ...boundary,
    ...nav,
    theme,
    pages: input.page
      ? { [input.pageId ?? "home"]: { sections: input.page.sections } }
      : {},
  });
}

export function zoneManageDraftToBoundary(
  draft: ZoneManageDraft,
): ZoneBoundary {
  return {
    schema: "rezics/zone-boundary",
    version: 1,
    context: deepClone(draft.context),
    filters: deepClone(draft.filters),
  };
}

export function zoneManageDraftToNav(draft: ZoneManageDraft): ZoneNav {
  return {
    schema: "rezics/zone-nav",
    version: 1,
    menus: deepClone(draft.menus),
    header: deepClone(draft.header),
  };
}

export function zoneManageDraftToTheme(draft: ZoneManageDraft): ZoneTheme {
  return {
    schema: "rezics/zone-theme",
    version: 1,
    tokens: deepClone(draft.theme.tokens),
    images: deepClone(draft.theme.images),
    layout: deepClone(draft.theme.layout),
  };
}

export function zoneManageDraftToPage(
  draft: ZoneManageDraft,
  pageId: ZonePageId,
): ZonePage {
  return {
    schema: "rezics/zone-page",
    version: 1,
    sections: deepClone(draft.pages[pageId]?.sections ?? []),
  };
}

function stripEnvelopeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const {
    schema: _schema,
    version: _version,
    ...body
  } = value as Record<string, unknown>;
  return body;
}

function zoneManageJsonEnvelope(
  target: ZoneManageJsonTarget,
  body: unknown,
): ZoneBoundary | ZoneNav | ZoneTheme | ZonePage {
  const stripped = stripEnvelopeMetadata(body);
  switch (target.kind) {
    case "boundary":
      return {
        schema: ZONE_BOUNDARY_SCHEMA,
        version: ZONE_BOUNDARY_V1_VERSION,
        ...stripped,
      } as ZoneBoundary;
    case "nav":
      return {
        schema: ZONE_NAV_SCHEMA,
        version: ZONE_NAV_V1_VERSION,
        ...stripped,
      } as ZoneNav;
    case "theme":
      return {
        schema: ZONE_THEME_SCHEMA,
        version: ZONE_THEME_V1_VERSION,
        ...stripped,
      } as ZoneTheme;
    case "page":
      return {
        schema: ZONE_PAGE_SCHEMA,
        version: ZONE_PAGE_V1_VERSION,
        ...stripped,
      } as ZonePage;
  }
}

function zoneManageJsonSchema(target: ZoneManageJsonTarget) {
  switch (target.kind) {
    case "boundary":
      return zoneBoundaryV1Schema;
    case "nav":
      return zoneNavV1Schema;
    case "theme":
      return zoneThemeV1Schema;
    case "page":
      return zonePageV1Schema;
  }
}

export function zoneManageJsonKey(target: ZoneManageJsonTarget): string {
  return target.kind === "page" ? `page:${target.pageId}` : target.kind;
}

/**
 * JSON manage view edits envelope bodies only. Top-level `schema` and
 * `version` keys are deliberately stripped before draft/application because
 * those literals are system-owned at the write boundary.
 */
export function zoneManageJsonBody(
  draft: ZoneManageDraft,
  target: ZoneManageJsonTarget,
): unknown {
  switch (target.kind) {
    case "boundary":
      return deepClone({ context: draft.context, filters: draft.filters });
    case "nav":
      return deepClone({ menus: draft.menus, header: draft.header });
    case "theme":
      return deepClone(draft.theme);
    case "page":
      return deepClone({
        sections: draft.pages[target.pageId]?.sections ?? [],
      });
  }
}

export function zoneManageJsonText(
  draft: ZoneManageDraft,
  target: ZoneManageJsonTarget,
): string {
  return JSON.stringify(zoneManageJsonBody(draft, target), null, 2);
}

export function validateZoneManageJsonBody(
  target: ZoneManageJsonTarget,
  body: unknown,
): ZoneManageJsonProblem[] {
  const schema = zoneManageJsonSchema(target);
  const envelope = zoneManageJsonEnvelope(target, body);
  if (Value.Check(schema, envelope)) return [];
  return [...Value.Errors(schema, envelope)].map((error) => ({
    path: error.path || "/",
    message: error.message,
  }));
}

export function parseZoneManageJsonText(
  target: ZoneManageJsonTarget,
  text: string,
):
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; problems: ZoneManageJsonProblem[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      problems: [
        {
          path: "/",
          message: error instanceof Error ? error.message : "Invalid JSON",
        },
      ],
    };
  }
  const body = stripEnvelopeMetadata(parsed);
  const problems = validateZoneManageJsonBody(target, body);
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, body };
}

export function applyZoneManageJsonBody(
  draft: ZoneManageDraft,
  target: ZoneManageJsonTarget,
  rawBody: unknown,
): ZoneManageDraft {
  const body = stripEnvelopeMetadata(rawBody);
  switch (target.kind) {
    case "boundary":
      return {
        ...draft,
        context: deepClone(body.context) as ZoneManageDraft["context"],
        filters: deepClone(body.filters) as ZoneManageDraft["filters"],
      };
    case "nav":
      return {
        ...draft,
        menus: deepClone(body.menus) as ZoneManageDraft["menus"],
        header: deepClone(body.header) as ZoneManageDraft["header"],
      };
    case "theme":
      return {
        ...draft,
        theme: deepClone(body) as ZoneManageDraft["theme"],
      };
    case "page":
      return {
        ...draft,
        pages: updateZonePageSections(
          draft.pages,
          target.pageId,
          () => deepClone(body.sections) as ZonePageSection[],
        ),
      };
  }
}

// ANCHOR: Section slots and nesting guards
// ANCHOR: 分区插槽与嵌套守卫

export const ZONE_CONTENT_SECTION_KINDS = [
  "hero",
  "richText",
  "collection",
  "query",
  "feed",
  "stats",
  "sources",
] as const;

export const ZONE_PAGE_SECTION_KINDS = [
  ...ZONE_CONTENT_SECTION_KINDS,
  "tabs",
  "columns",
] as const;

export type ZoneSectionSlot = "page" | "tabs" | "columns";

/**
 * Client-side mirror of the contract's container nesting rules (see
 * `package/contract/src/zone/section.ts`): tabs panes hold content sections
 * only; columns panes hold content sections or tabs; columns appears only
 * at page top level.
 * 契约容器嵌套规则的客户端镜像（见 `package/contract/src/zone/section.ts`）：
 * tabs 面板只容纳内容分区；columns 面板容纳内容分区或 tabs；columns 只
 * 出现在页面顶层。
 */
export function zoneSectionSlotAllowedKinds(
  slot: ZoneSectionSlot,
): readonly ZonePageSection["kind"][] {
  switch (slot) {
    case "page":
      return ZONE_PAGE_SECTION_KINDS;
    case "tabs":
      return ZONE_CONTENT_SECTION_KINDS;
    case "columns":
      return [...ZONE_CONTENT_SECTION_KINDS, "tabs"];
  }
}

export function canInsertZoneSectionKind(
  slot: ZoneSectionSlot,
  kind: ZonePageSection["kind"],
): boolean {
  return (zoneSectionSlotAllowedKinds(slot) as readonly string[]).includes(
    kind,
  );
}

/**
 * Minimal-valid section factory used by the "add section" affordance. The
 * `query` default keeps the required `sort` populated with a field sortable
 * on both targets.
 * 「新增分区」入口使用的最小有效分区工厂。`query` 默认值用两种目标都可
 * 排序的字段填充必填的 `sort`。
 */
export function createZoneSection(
  kind: ZonePageSection["kind"],
  id: string,
): ZonePageSection {
  switch (kind) {
    case "hero":
      return { id, kind: "hero" };
    case "richText":
      return { id, kind: "richText", contentUnitId: "" };
    case "collection":
      return { id, kind: "collection", items: [], display: "list" };
    case "query":
      return {
        id,
        kind: "query",
        query: {
          target: "unit",
          sort: { field: "updatedAt", direction: "desc" },
        },
        display: "list",
      };
    case "feed":
      return { id, kind: "feed" };
    case "stats":
      return { id, kind: "stats", metrics: ["articles", "members"] };
    case "sources":
      return { id, kind: "sources" };
    case "tabs":
      return { id, kind: "tabs", tabs: [] };
    case "columns":
      return {
        id,
        kind: "columns",
        columns: [
          { id: "main", ratio: 3, sections: [] },
          { id: "side", ratio: 1, sections: [] },
        ],
      };
  }
}

function* iterateSections(
  sections: readonly ZonePageSection[],
): Generator<ZonePageSection> {
  for (const section of sections) {
    yield section;
    if (section.kind === "tabs") {
      for (const tab of section.tabs) yield* iterateSections(tab.sections);
    }
    if (section.kind === "columns") {
      for (const column of section.columns) {
        yield* iterateSections(column.sections);
      }
    }
  }
}

function pageSections(
  pages: ZonePages,
  pageId: ZonePageId,
): readonly ZonePageSection[] {
  return pages[pageId]?.sections ?? [];
}

/**
 * Every section id across the loaded page draft, containers and nested
 * sections included. Section ids are page-local in the split ZonePage model.
 * 已加载页面草稿中的每个分区 id，包含容器与嵌套分区。拆分后的
 * ZonePage 模型中，分区 id 的唯一性是页面局部的。
 */
export function collectZoneSectionIds(pages: ZonePages): string[] {
  const ids: string[] = [];
  for (const pageId of Object.keys(pages)) {
    for (const section of iterateSections(pageSections(pages, pageId))) {
      ids.push(section.id);
    }
  }
  return ids;
}

/**
 * First free `${prefix}-${n}` id, so add affordances never collide with
 * existing ids.
 * 第一个空闲的 `${prefix}-${n}` id，使新增入口绝不与既有 id 冲突。
 */
export function nextZoneId(prefix: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  for (let n = 1; ; n += 1) {
    const candidate = `${prefix}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function moveListItem<T>(
  list: readonly T[],
  index: number,
  direction: "up" | "down",
): T[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= list.length) return [...list];
  if (target < 0 || target >= list.length) return [...list];
  const next = [...list];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved as T);
  return next;
}

// ANCHOR: Query vocabulary
// ANCHOR: 查询词汇表

/**
 * Query builder vocabulary is contract-owned so the app editor and server
 * compiler cannot drift when a target such as `zone` is added.
 * 查询构建器词汇表由契约拥有，避免应用端编辑器与服务端编译器在新增
 * `zone` 等目标时漂移。
 */
export type ZoneQueryFilterField = ZoneSectionQueryFilterField;
export type ZoneQuerySortField = ZoneSectionQuerySortField;
export const ZONE_QUERY_FILTERABLE_FIELDS =
  ZONE_SECTION_QUERY_FILTERABLE_FIELDS;
export const ZONE_QUERY_SORT_FIELDS = ZONE_SECTION_QUERY_SORT_FIELDS;

export function zoneQueryUnsupportedFields(query: ZoneSectionQuery): string[] {
  const filterable: readonly ZoneSectionQueryFilterField[] =
    ZONE_QUERY_FILTERABLE_FIELDS[query.target];
  const sortable: readonly ZoneSectionQuerySortField[] =
    ZONE_QUERY_SORT_FIELDS[query.target];
  const unsupported: string[] = [];
  for (const key of Object.keys(query) as (keyof ZoneSectionQuery)[]) {
    if (key === "target" || key === "sort") continue;
    if (query[key] === undefined) continue;
    if (!filterable.includes(key as ZoneQueryFilterField)) {
      unsupported.push(key);
    }
  }
  if (!sortable.includes(query.sort.field)) {
    unsupported.push(`sort.${query.sort.field}`);
  }
  return unsupported;
}

const ZONE_DYNAMIC_TAG_PROBABILITY_EPSILON = 0.000001;

export function zoneDynamicTagsProbabilityTotal(
  dynamicTags: ZoneDynamicTags,
): number {
  return dynamicTags.options.reduce(
    (sum, option) => sum + option.probability,
    0,
  );
}

export function zoneDynamicTagsFallbackProbability(
  dynamicTags: ZoneDynamicTags,
): number {
  return Math.max(0, 1 - zoneDynamicTagsProbabilityTotal(dynamicTags));
}

export function zoneDynamicTagsProbabilityValid(
  dynamicTags: ZoneDynamicTags,
): boolean {
  const total = zoneDynamicTagsProbabilityTotal(dynamicTags);
  if (dynamicTags.fallback) {
    return total <= 1 + ZONE_DYNAMIC_TAG_PROBABILITY_EPSILON;
  }
  return Math.abs(total - 1) <= ZONE_DYNAMIC_TAG_PROBABILITY_EPSILON;
}

/**
 * Switching the query target drops filters and sort fields the new target
 * cannot serve, instead of letting the save fail server-side.
 * 切换查询目标时丢弃新目标无法服务的过滤与排序字段，而不是让保存在
 * 服务端失败。
 */
export function coerceZoneQueryTarget(
  query: ZoneSectionQuery,
  target: ZoneSectionQuery["target"],
): ZoneSectionQuery {
  if (query.target === target) return query;
  const filterable: readonly ZoneQueryFilterField[] =
    ZONE_QUERY_FILTERABLE_FIELDS[target];
  const sortable: readonly ZoneQuerySortField[] =
    ZONE_QUERY_SORT_FIELDS[target];
  const next: ZoneSectionQuery = { target, sort: { ...query.sort } };
  for (const key of filterable) {
    const value = query[key];
    if (value !== undefined) {
      (next as Record<string, unknown>)[key] = value;
    }
  }
  if (!sortable.includes(next.sort.field)) {
    next.sort = { ...next.sort, field: "createdAt" };
  }
  return next;
}

// ANCHOR: Menu tree path operations
// ANCHOR: 菜单树路径操作

/**
 * A node's address as sibling indexes from the menu root; `[]` addresses
 * the root list itself. Depth of the node at `path` is `path.length`.
 * 节点地址为自菜单根起的同级索引序列；`[]` 指根列表本身。位于 `path`
 * 的节点深度为 `path.length`。
 */
export type ZoneMenuNodePath = readonly number[];

export function zoneMenuNodeAtPath(
  nodes: readonly ZoneMenuNode[],
  path: ZoneMenuNodePath,
): ZoneMenuNode | null {
  let current: readonly ZoneMenuNode[] = nodes;
  let node: ZoneMenuNode | null = null;
  for (const index of path) {
    node = current[index] ?? null;
    if (!node) return null;
    current = node.children ?? [];
  }
  return node;
}

export function updateZoneMenuNodeAtPath(
  nodes: readonly ZoneMenuNode[],
  path: ZoneMenuNodePath,
  updater: (node: ZoneMenuNode) => ZoneMenuNode,
): ZoneMenuNode[] {
  if (path.length === 0) return [...nodes];
  const [head, ...rest] = path as readonly [number, ...number[]];
  return nodes.map((node, index) => {
    if (index !== head) return node;
    if (rest.length === 0) return updater(node);
    return {
      ...node,
      children: updateZoneMenuNodeAtPath(node.children ?? [], rest, updater),
    };
  });
}

export function zoneMenuDepth(nodes: readonly ZoneMenuNode[]): number {
  let depth = 0;
  for (const node of nodes) {
    depth = Math.max(
      depth,
      1 + (node.children ? zoneMenuDepth(node.children) : 0),
    );
  }
  return depth;
}

function zoneMenuSubtreeHeight(node: ZoneMenuNode): number {
  return 1 + (node.children?.length ? zoneMenuDepth(node.children) : 0);
}

export function canAddZoneMenuChild(parentPath: ZoneMenuNodePath): boolean {
  return parentPath.length + 1 <= ZONE_MENU_MAX_DEPTH;
}

/**
 * Appends `node` under `parentPath` (`[]` = root). Returns null when the
 * insert would exceed `ZONE_MENU_MAX_DEPTH` — callers surface the guard
 * instead of producing an invalid tree.
 * 将 `node` 追加到 `parentPath` 之下（`[]` 为根）。当插入将超过
 * `ZONE_MENU_MAX_DEPTH` 时返回 null——调用方提示该守卫而不是产生非法树。
 */
export function insertZoneMenuNode(
  nodes: readonly ZoneMenuNode[],
  parentPath: ZoneMenuNodePath,
  node: ZoneMenuNode,
): ZoneMenuNode[] | null {
  if (parentPath.length + zoneMenuSubtreeHeight(node) > ZONE_MENU_MAX_DEPTH) {
    return null;
  }
  if (parentPath.length === 0) return [...nodes, node];
  return updateZoneMenuNodeAtPath(nodes, parentPath, (parent) => ({
    ...parent,
    children: [...(parent.children ?? []), node],
  }));
}

export function removeZoneMenuNodeAtPath(
  nodes: readonly ZoneMenuNode[],
  path: ZoneMenuNodePath,
): ZoneMenuNode[] {
  if (path.length === 0) return [...nodes];
  if (path.length === 1) {
    return nodes.filter((_, index) => index !== path[0]);
  }
  const parentPath = path.slice(0, -1);
  const leaf = path[path.length - 1] as number;
  return updateZoneMenuNodeAtPath(nodes, parentPath, (parent) => {
    const children = (parent.children ?? []).filter(
      (_, index) => index !== leaf,
    );
    const next = { ...parent };
    if (children.length > 0) next.children = children;
    else delete next.children;
    return next;
  });
}

/**
 * Sibling reorder; no-op past either edge.
 * 同级重排；越过边界时为空操作。
 */
export function moveZoneMenuNodeAtPath(
  nodes: readonly ZoneMenuNode[],
  path: ZoneMenuNodePath,
  direction: "up" | "down",
): ZoneMenuNode[] {
  if (path.length === 0) return [...nodes];
  const leaf = path[path.length - 1] as number;
  if (path.length === 1) return moveListItem(nodes, leaf, direction);
  return updateZoneMenuNodeAtPath(nodes, path.slice(0, -1), (parent) => ({
    ...parent,
    children: moveListItem(parent.children ?? [], leaf, direction),
  }));
}

/**
 * Moves the node into its previous sibling (as last child). Returns null
 * when there is no previous sibling or the subtree would exceed depth 3.
 * 将节点移入其前一个同级（作为最后一个子节点）。无前一个同级或子树将
 * 超过深度 3 时返回 null。
 */
export function indentZoneMenuNodeAtPath(
  nodes: readonly ZoneMenuNode[],
  path: ZoneMenuNodePath,
): ZoneMenuNode[] | null {
  const leaf = path[path.length - 1];
  if (leaf === undefined || leaf === 0) return null;
  const node = zoneMenuNodeAtPath(nodes, path);
  if (!node) return null;
  // New depth = old depth + 1; the whole subtree must still fit.
  // 新深度 = 旧深度 + 1；整个子树仍须放得下。
  if (path.length + zoneMenuSubtreeHeight(node) > ZONE_MENU_MAX_DEPTH) {
    return null;
  }
  const removed = removeZoneMenuNodeAtPath(nodes, path);
  const previousSiblingPath = [...path.slice(0, -1), leaf - 1];
  return updateZoneMenuNodeAtPath(removed, previousSiblingPath, (parent) => ({
    ...parent,
    children: [...(parent.children ?? []), node],
  }));
}

/**
 * Moves the node out to its parent's level, right after the parent.
 * Returns null for root-level nodes.
 * 将节点移出到其父级所在层，紧随父级之后。根层节点返回 null。
 */
export function outdentZoneMenuNodeAtPath(
  nodes: readonly ZoneMenuNode[],
  path: ZoneMenuNodePath,
): ZoneMenuNode[] | null {
  if (path.length < 2) return null;
  const node = zoneMenuNodeAtPath(nodes, path);
  if (!node) return null;
  const removed = removeZoneMenuNodeAtPath(nodes, path);
  const parentPath = path.slice(0, -1);
  const parentLeaf = parentPath[parentPath.length - 1] as number;
  const grandParentPath = parentPath.slice(0, -1);
  if (grandParentPath.length === 0) {
    const next = [...removed];
    next.splice(parentLeaf + 1, 0, node);
    return next;
  }
  return updateZoneMenuNodeAtPath(removed, grandParentPath, (grandParent) => {
    const children = [...(grandParent.children ?? [])];
    children.splice(parentLeaf + 1, 0, node);
    return { ...grandParent, children };
  });
}

// ANCHOR: Draft validation
// ANCHOR: 草稿校验

/**
 * Client-side mirror of `assertConfigStructure` in
 * `package/server/src/zone/zone.service.ts` so the editor can surface
 * structural problems before the write round-trip. The server remains the
 * enforcement point.
 * `package/server/src/zone/zone.service.ts` 中 `assertConfigStructure`
 * 的客户端镜像，使编辑器能在写入往返之前提示结构问题。服务端仍是强制
 * 执行点。
 */
export type ZoneManageIssue =
  | { code: "section_id_duplicate"; id: string }
  | { code: "tab_id_duplicate"; sectionId: string }
  | { code: "tab_default_invalid"; sectionId: string }
  | { code: "query_field_unsupported"; sectionId: string; fields: string[] }
  | { code: "dynamic_tags_target_unsupported"; sectionId: string }
  | {
      code: "dynamic_tags_probability_invalid";
      sectionId: string;
      total: number;
    }
  | { code: "menu_id_duplicate"; id: string }
  | { code: "menu_too_deep"; menuId: string }
  | { code: "menu_leaf_missing_target"; menuId: string; nodeId: string }
  | { code: "menu_group_missing_label"; menuId: string; nodeId: string }
  | { code: "header_menu_invalid"; menuId: string };

function* iterateMenuNodes(
  nodes: readonly ZoneMenuNode[],
): Generator<ZoneMenuNode> {
  for (const node of nodes) {
    yield node;
    if (node.children) yield* iterateMenuNodes(node.children);
  }
}

export function validateZoneManageDraft(
  draft: ZoneManageDraft,
): ZoneManageIssue[] {
  const issues: ZoneManageIssue[] = [];

  const sectionIds = new Set<string>();
  for (const pageId of Object.keys(draft.pages)) {
    for (const section of iterateSections(pageSections(draft.pages, pageId))) {
      if (sectionIds.has(section.id)) {
        issues.push({ code: "section_id_duplicate", id: section.id });
      }
      sectionIds.add(section.id);
      if (section.kind === "tabs") {
        const tabIds = new Set(section.tabs.map((tab) => tab.id));
        if (tabIds.size !== section.tabs.length) {
          issues.push({ code: "tab_id_duplicate", sectionId: section.id });
        }
        if (section.defaultTabId && !tabIds.has(section.defaultTabId)) {
          issues.push({ code: "tab_default_invalid", sectionId: section.id });
        }
      }
      if (section.kind === "query") {
        const fields = zoneQueryUnsupportedFields(section.query);
        if (fields.length > 0) {
          issues.push({
            code: "query_field_unsupported",
            sectionId: section.id,
            fields,
          });
        }
        if (section.dynamicTags) {
          if (section.query.target !== "unit") {
            issues.push({
              code: "dynamic_tags_target_unsupported",
              sectionId: section.id,
            });
          }
          if (!zoneDynamicTagsProbabilityValid(section.dynamicTags)) {
            issues.push({
              code: "dynamic_tags_probability_invalid",
              sectionId: section.id,
              total: zoneDynamicTagsProbabilityTotal(section.dynamicTags),
            });
          }
        }
      }
    }
  }

  const menuIds = new Set<string>();
  for (const menu of draft.menus) {
    if (menuIds.has(menu.id)) {
      issues.push({ code: "menu_id_duplicate", id: menu.id });
    }
    menuIds.add(menu.id);
    if (zoneMenuDepth(menu.nodes) > ZONE_MENU_MAX_DEPTH) {
      issues.push({ code: "menu_too_deep", menuId: menu.id });
    }
    for (const node of iterateMenuNodes(menu.nodes)) {
      const isGroup = (node.children?.length ?? 0) > 0;
      if (!isGroup && !node.target) {
        issues.push({
          code: "menu_leaf_missing_target",
          menuId: menu.id,
          nodeId: node.id,
        });
      }
      if (isGroup && !node.labelUnitId && !node.target) {
        issues.push({
          code: "menu_group_missing_label",
          menuId: menu.id,
          nodeId: node.id,
        });
      }
    }
  }
  if (!menuIds.has(draft.header.menuId)) {
    issues.push({ code: "header_menu_invalid", menuId: draft.header.menuId });
  }

  return issues;
}

// ANCHOR: Translation rows
// ANCHOR: 译文行

export type ZoneTranslationRow = {
  language: ContentLanguage;
  title: string;
  description: string;
};

export const ZONE_TRANSLATION_LANGUAGES: ContentLanguage[] =
  CONTENT_LANGUAGE_SLUGS;

export function zoneTranslationsToRows(
  translations: readonly ZoneTranslation[],
): ZoneTranslationRow[] {
  return translations.map((translation) => ({
    language: translation.language,
    title: translation.title ?? "",
    description: translation.description ?? "",
  }));
}

/**
 * Empty title/description fields are dropped rather than persisted as empty
 * strings, matching the optional contract fields.
 * 空的标题/描述字段被丢弃而非以空字符串持久化，与契约的可选字段对齐。
 */
export function zoneRowsToTranslations(
  rows: readonly ZoneTranslationRow[],
): ZoneTranslation[] {
  return rows.map((row) => ({
    language: row.language,
    ...(row.title.trim() ? { title: row.title.trim() } : {}),
    ...(row.description.trim() ? { description: row.description.trim() } : {}),
  }));
}

export function zoneTranslationLanguageOptions(
  rows: readonly ZoneTranslationRow[],
  current?: ContentLanguage,
): ContentLanguage[] {
  const used = new Set(rows.map((row) => row.language));
  return ZONE_TRANSLATION_LANGUAGES.filter(
    (language) => language === current || !used.has(language),
  );
}

/**
 * Adds a row for the first unused language; no-op when every language
 * already has a row.
 * 为第一个未使用的语言新增一行；所有语言均已有行时为空操作。
 */
export function addZoneTranslationRow(
  rows: readonly ZoneTranslationRow[],
): ZoneTranslationRow[] {
  const [language] = zoneTranslationLanguageOptions(rows);
  if (!language) return [...rows];
  return [...rows, { language, title: "", description: "" }];
}

export function updateZoneTranslationRow(
  rows: readonly ZoneTranslationRow[],
  index: number,
  patch: Partial<ZoneTranslationRow>,
): ZoneTranslationRow[] {
  return rows.map((row, current) =>
    current === index ? { ...row, ...patch } : row,
  );
}

export function removeZoneTranslationRow(
  rows: readonly ZoneTranslationRow[],
  index: number,
): ZoneTranslationRow[] {
  return rows.filter((_, current) => current !== index);
}

// ANCHOR: Page helpers
// ANCHOR: 页面辅助

export function updateZonePageSections(
  pages: ZonePages,
  pageId: ZonePageId,
  updater: (sections: readonly ZonePageSection[]) => ZonePageSection[],
): ZonePages {
  const page = pages[pageId];
  if (!page) return pages;
  return { ...pages, [pageId]: { sections: updater(page.sections) } };
}

export function addZonePage(pages: ZonePages, pageId: ZonePageId): ZonePages {
  if (pages[pageId]) return pages;
  return { ...pages, [pageId]: { sections: [] } };
}

export function removeZonePage(
  pages: ZonePages,
  pageId: ZonePageId,
): ZonePages {
  const next = { ...pages };
  delete next[pageId];
  return next;
}

export function zonePageToDraftPage(page: ZonePage): ZonePages[string] {
  return deepClone({ sections: page.sections });
}
