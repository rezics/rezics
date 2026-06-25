import type {
  EnrichedShelfItem,
  ShelfSortState,
  ShelfView,
} from "@rezics/contract/api/shelf/shelf";
import type { ShelfItemChildDTO, ShelfItemDTO } from "@rezics/contract";
import {
  shelfItemIdentity,
  shelfItemIdentityFromParts,
  shelfItemReference,
} from "@rezics/contract";
import { titleOf } from "./titleOf";

export interface ShelfStreamRootEntry {
  kind: "root";
  unit: EnrichedShelfItem;
  /**
   * Children grouped under this root (review/tag), pre-sorted.
   * 归组在该 root 下的子项（review/tag），已预先排序。
   */
  children: EnrichedShelfItem[];
}

export interface ShelfStreamChildEntry {
  kind: "child";
  unit: EnrichedShelfItem;
  parentUnitId: string;
  parent?: EnrichedShelfItem;
}

export interface ShelfStreamPeerEntry {
  kind: "peer";
  unit: EnrichedShelfItem;
}

export type ShelfStreamEntry =
  | ShelfStreamRootEntry
  | ShelfStreamChildEntry
  | ShelfStreamPeerEntry;

interface DerivationParts {
  byId: Map<string, EnrichedShelfItem>;
  childByParent: Map<string, EnrichedShelfItem[]>;
  childIds: Set<string>;
  roots: EnrichedShelfItem[];
}

const titleCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function comparePosition(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function maybeReverse(value: number, order: ShelfSortState["order"]): number {
  return order === "desc" ? -value : value;
}

function tieBreak(a: EnrichedShelfItem, b: EnrichedShelfItem): number {
  return (
    comparePosition(a.unit.position, b.unit.position) ||
    titleCollator.compare(shelfItemIdentity(a.unit), shelfItemIdentity(b.unit))
  );
}

function compareByMode(
  a: EnrichedShelfItem,
  b: EnrichedShelfItem,
  sort: ShelfSortState,
): number {
  if (sort.field === "manual") {
    return (
      maybeReverse(
        comparePosition(a.unit.position, b.unit.position),
        sort.order,
      ) ||
      titleCollator.compare(
        shelfItemIdentity(a.unit),
        shelfItemIdentity(b.unit),
      )
    );
  }
  if (sort.field === "addedAt") {
    const aT = a.unit.createdAt ? new Date(a.unit.createdAt).getTime() : 0;
    const bT = b.unit.createdAt ? new Date(b.unit.createdAt).getTime() : 0;
    return maybeReverse(aT - bT, sort.order) || tieBreak(a, b);
  }
  return (
    maybeReverse(
      titleCollator.compare(titleOfUnit(a), titleOfUnit(b)),
      sort.order,
    ) || tieBreak(a, b)
  );
}

function titleOfUnit(e: EnrichedShelfItem): string {
  return titleOf(e.unit, e.data);
}

function sortedClone(
  units: EnrichedShelfItem[],
  sort: ShelfSortState,
): EnrichedShelfItem[] {
  const arr = [...units];
  arr.sort((a, b) => compareByMode(a, b, sort));
  return arr;
}

function partition(
  units: EnrichedShelfItem[],
  relations: ShelfItemChildDTO[],
): DerivationParts {
  const byId = new Map<string, EnrichedShelfItem>();
  for (const e of units) byId.set(shelfItemIdentity(e.unit), e);

  const childByParent = new Map<string, EnrichedShelfItem[]>();
  const childIds = new Set<string>();
  const normalizedRelations =
    relations.length > 0
      ? relations
      : units
          .map((entry) => entry.unit)
          .filter((item) => item.parentItemId)
          .map((item) => ({
            shelfId: item.shelfId,
            parentItemType: item.parentItemType ?? "unit",
            parentItemId: item.parentItemId!,
            childItemType: item.itemType ?? "unit",
            childItemId: item.itemId,
            role: item.parentRole ?? "review",
          }));
  for (const rel of normalizedRelations) {
    const childKey = shelfItemIdentityFromParts(
      rel.childItemType,
      rel.childItemId,
    );
    const parentKey = shelfItemIdentityFromParts(
      rel.parentItemType,
      rel.parentItemId,
    );
    childIds.add(childKey);
    const child = byId.get(childKey);
    if (!child) continue;
    let bucket = childByParent.get(parentKey);
    if (!bucket) {
      bucket = [];
      childByParent.set(parentKey, bucket);
    }
    if (!bucket.includes(child)) bucket.push(child);
  }

  const roots: EnrichedShelfItem[] = [];
  for (const e of units) {
    if (!childIds.has(shelfItemIdentity(e.unit))) roots.push(e);
  }

  return { byId, childByParent, childIds, roots };
}

/**
 * Pure derivation of the rendered stream from ShelfItem parent fields.
 * 基于 ShelfItem 的 parent 字段对渲染流进行的纯派生。
 *
 * - Roots = items that do not have a parent item.
 *   Roots = 没有父项的项。
 * - In nested mode: returns root entries; consumers render attached children
 *   inside each root via `entry.children`.
 *   nested 模式：返回 root 条目；消费方通过 `entry.children` 在每个 root 内
 *   渲染附属子项。
 * - In flat + `sortPrimeOnly=true`: roots sorted first, each root's
 *   children sorted by the same comparator, emitted immediately after the root.
 *   flat + `sortPrimeOnly=true`：先排序 roots，每个 root 的子项用
 *   同一比较器排序，并紧跟在该 root 之后输出。
 * - In flat + `sortPrimeOnly=false`: every ShelfItem is emitted once as
 *   a peer, all participating in one comparator.
 *   flat + `sortPrimeOnly=false`：每个 ShelfItem 作为 peer 输出一次，
 *   全部参与同一个比较器。
 *
 * Multi-step cycles in the relation graph cannot infinitely recurse because
 * the nested entry shape is one level deep (children only); two-step cycles
 * just render each affected unit under its parent(s) and not as a root.
 * 关系图中的多步环不会无限递归，因为 nested 条目结构只有一层深（仅含子项）；
 * 两步环只会把受影响的每个 unit 渲染在其父项下，而不作为 root。
 */
export function deriveShelfStream(
  units: EnrichedShelfItem[],
  relations: ShelfItemChildDTO[],
  mode: ShelfView,
  sort: ShelfSortState,
  sortPrimeOnly: boolean,
): ShelfStreamEntry[] {
  const { childByParent, roots } = partition(units, relations);

  if (mode === "nested") {
    return sortedClone(roots, sort).map((root) => ({
      kind: "root" as const,
      unit: root,
      children: sortedClone(
        childByParent.get(shelfItemIdentity(root.unit)) ?? [],
        sort,
      ),
    }));
  }

  if (sortPrimeOnly) {
    const out: ShelfStreamEntry[] = [];
    for (const root of sortedClone(roots, sort)) {
      out.push({ kind: "root", unit: root, children: [] });
      const kids = sortedClone(
        childByParent.get(shelfItemIdentity(root.unit)) ?? [],
        sort,
      );
      for (const child of kids) {
        out.push({
          kind: "child",
          unit: child,
          parentUnitId: shelfItemReference(root.unit),
          parent: root,
        });
      }
    }
    return out;
  }

  return sortedClone(units, sort).map((unit) => ({
    kind: "peer" as const,
    unit,
  }));
}

export function shelfItemsById(
  units: EnrichedShelfItem[],
): Map<string, EnrichedShelfItem> {
  const m = new Map<string, EnrichedShelfItem>();
  for (const e of units) m.set(shelfItemIdentity(e.unit), e);
  return m;
}

export function findChildren(
  units: EnrichedShelfItem[],
  relations: ShelfItemChildDTO[],
  parentUnitId: string,
  role?: ShelfItemChildDTO["role"],
): EnrichedShelfItem[] {
  const byId = shelfItemsById(units);
  const out: EnrichedShelfItem[] = [];
  const normalizedRelations =
    relations.length > 0
      ? relations
      : units
          .map((entry) => entry.unit)
          .filter((item) => item.parentItemId)
          .map((item) => ({
            shelfId: item.shelfId,
            parentItemType: item.parentItemType ?? "unit",
            parentItemId: item.parentItemId!,
            childItemType: item.itemType ?? "unit",
            childItemId: item.itemId,
            role: item.parentRole ?? "review",
          }));
  for (const rel of normalizedRelations) {
    if (rel.parentItemType !== "unit" || rel.parentItemId !== parentUnitId) {
      continue;
    }
    if (role && rel.role !== role) continue;
    const child = byId.get(
      shelfItemIdentityFromParts(rel.childItemType, rel.childItemId),
    );
    if (child && !out.includes(child)) out.push(child);
  }
  return out;
}

// Lightweight rehydration helper for callsites that have a plain unit list and
// need the partition utilities for tests.
// 轻量级重建辅助函数，供持有普通 unit 列表、并在测试中需要 partition 工具的
// 调用方使用。
export function partitionForTest(
  units: EnrichedShelfItem[],
  relations: ShelfItemChildDTO[],
): { roots: ShelfItemDTO[]; childIds: Set<string> } {
  const { roots, childIds } = partition(units, relations);
  return {
    roots: roots.map((r) => r.unit),
    childIds,
  };
}
