import { t } from "elysia";
import { type ZoneLinkTarget, zoneLinkTargetSchema } from "./link-target";

// ANCHOR: Zone menu tree
// ANCHOR: 专区菜单树

/**
 * Menus live inside the zone nav envelope (not separately persisted like
 * `ContentStructure`): menus and the header referencing them must change in
 * one atomic versioned write.
 * 菜单存放在专区导航信封内部（不像 `ContentStructure` 单独持久化）：
 * 菜单与引用它们的 header 必须在一次原子化的版本写入中变更。
 *
 * Node label resolution chain: `labelUnitId` (LABEL unit) → target unit's
 * translated title → `external.text`. A node pointing at a unit therefore
 * needs no label config at all.
 * 节点标签解析链：`labelUnitId`（LABEL Unit）→ 目标 Unit 的译文标题 →
 * `external.text`。因此指向 Unit 的节点完全不需要标签配置。
 */
export const zoneMenuNodeSchema: ReturnType<typeof t.Recursive> = t.Recursive(
  (self) =>
    t.Object(
      {
        labelUnitId: t.Optional(t.String()),
        target: t.Optional(zoneLinkTargetSchema),
        children: t.Optional(t.Array(self)),
      },
      { additionalProperties: false },
    ),
);

export interface ZoneMenuNode {
  labelUnitId?: string;
  target?: ZoneLinkTarget;
  children?: ZoneMenuNode[];
}

/**
 * Structural rules enforced by the server-side config validator (TypeBox
 * cannot express them):
 * - tree depth ≤ `ZONE_MENU_MAX_DEPTH`;
 * - a group node (with `children`) needs `labelUnitId` or `target` to
 *   resolve a label; a leaf node needs `target`.
 * 由服务端配置校验器强制执行的结构规则（TypeBox 无法表达）：
 * - 树深度 ≤ `ZONE_MENU_MAX_DEPTH`；
 * - 分组节点（带 `children`）需要 `labelUnitId` 或 `target` 来解析标签；
 *   叶子节点需要 `target`。
 */
export const ZONE_MENU_MAX_DEPTH = 3;

export const zoneMenuSchema = t.Object(
  {
    slug: t.String({ minLength: 1 }),
    nodes: t.Array(zoneMenuNodeSchema),
  },
  { additionalProperties: false },
);

export interface ZoneMenu {
  slug: string;
  nodes: ZoneMenuNode[];
}
