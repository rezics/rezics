import type {
  EnrichedShelfItem,
  ShelfSortState,
  ShelfView,
} from "@rezics/api/shelf";
import type { ShelfItemDTO, ShelfItemChildDTO } from "@rezics/contract";
import { titleOf } from "./titleOf";

export interface ShelfStreamRootEntry {
  kind: "root";
  unit: EnrichedShelfItem;
  /** Children grouped under this root (review/tag), pre-sorted. */
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
    titleCollator.compare(a.unit.unitId, b.unit.unitId)
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
      ) || titleCollator.compare(a.unit.unitId, b.unit.unitId)
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

interface DerivationParts {
  byId: Map<string, EnrichedShelfItem>;
  childByParent: Map<string, EnrichedShelfItem[]>;
  childIds: Set<string>;
  roots: EnrichedShelfItem[];
}

function partition(
  units: EnrichedShelfItem[],
  relations: ShelfItemChildDTO[],
): DerivationParts {
  const byId = new Map<string, EnrichedShelfItem>();
  for (const e of units) byId.set(e.unit.unitId, e);

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
            parentUnitId: item.parentItemId!,
            childItemType: item.itemType ?? "unit",
            childItemId: item.itemId ?? item.unitId,
            childUnitId: item.itemId ?? item.unitId,
            role: item.parentRole ?? "review",
          }));
  for (const rel of normalizedRelations) {
    const childUnitId = rel.childUnitId ?? rel.childItemId;
    const parentUnitId = rel.parentUnitId ?? rel.parentItemId;
    childIds.add(childUnitId);
    const child = byId.get(childUnitId);
    if (!child) continue;
    let bucket = childByParent.get(parentUnitId);
    if (!bucket) {
      bucket = [];
      childByParent.set(parentUnitId, bucket);
    }
    if (!bucket.includes(child)) bucket.push(child);
  }

  const roots: EnrichedShelfItem[] = [];
  for (const e of units) {
    if (!childIds.has(e.unit.unitId)) roots.push(e);
  }

  return { byId, childByParent, childIds, roots };
}

/**
 * Pure derivation of the rendered stream from ShelfItem parent fields.
 *
 * - Roots = items that do not have a parent item.
 * - In nested mode: returns root entries; consumers render attached children
 *   inside each root via `entry.children`.
 * - In flat/masonry + `sortPrimeOnly=true`: roots sorted first, each root's
 *   children sorted by the same comparator, emitted immediately after the root.
 * - In flat/masonry + `sortPrimeOnly=false`: every ShelfItem is emitted once as
 *   a peer, all participating in one comparator.
 *
 * Multi-step cycles in the relation graph cannot infinitely recurse because
 * the nested entry shape is one level deep (children only); two-step cycles
 * just render each affected unit under its parent(s) and not as a root.
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
      children: sortedClone(childByParent.get(root.unit.unitId) ?? [], sort),
    }));
  }

  if (sortPrimeOnly) {
    const out: ShelfStreamEntry[] = [];
    for (const root of sortedClone(roots, sort)) {
      out.push({ kind: "root", unit: root, children: [] });
      const kids = sortedClone(childByParent.get(root.unit.unitId) ?? [], sort);
      for (const child of kids) {
        out.push({
          kind: "child",
          unit: child,
          parentUnitId: root.unit.unitId,
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
  for (const e of units) m.set(e.unit.unitId, e);
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
            parentUnitId: item.parentItemId!,
            childItemType: item.itemType ?? "unit",
            childItemId: item.itemId ?? item.unitId,
            childUnitId: item.itemId ?? item.unitId,
            role: item.parentRole ?? "review",
          }));
  for (const rel of normalizedRelations) {
    const relParentUnitId = rel.parentUnitId ?? rel.parentItemId;
    if (relParentUnitId !== parentUnitId) continue;
    if (role && rel.role !== role) continue;
    const child = byId.get(rel.childUnitId ?? rel.childItemId);
    if (child && !out.includes(child)) out.push(child);
  }
  return out;
}

// Lightweight rehydration helper for callsites that have a plain unit list and
// need the partition utilities for tests.
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
