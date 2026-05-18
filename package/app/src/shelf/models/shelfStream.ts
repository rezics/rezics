import type {
  EnrichedShelfUnit,
  ShelfSortState,
  ShelfView,
} from "@rezics/api/shelf";
import type { ShelfUnitDTO, ShelfUnitRelationDTO } from "@rezics/contract";
import { titleOf } from "./titleOf";

export interface ShelfStreamRootEntry {
  kind: "root";
  unit: EnrichedShelfUnit;
  /** Children grouped under this root (review/tag), pre-sorted. */
  children: EnrichedShelfUnit[];
}

export interface ShelfStreamChildEntry {
  kind: "child";
  unit: EnrichedShelfUnit;
  parentUnitId: string;
}

export interface ShelfStreamPeerEntry {
  kind: "peer";
  unit: EnrichedShelfUnit;
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

function tieBreak(a: EnrichedShelfUnit, b: EnrichedShelfUnit): number {
  return (
    comparePosition(a.unit.position, b.unit.position) ||
    titleCollator.compare(a.unit.unitId, b.unit.unitId)
  );
}

function compareByMode(
  a: EnrichedShelfUnit,
  b: EnrichedShelfUnit,
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

function titleOfUnit(e: EnrichedShelfUnit): string {
  return titleOf(e.unit, e.data);
}

function sortedClone(
  units: EnrichedShelfUnit[],
  sort: ShelfSortState,
): EnrichedShelfUnit[] {
  const arr = [...units];
  arr.sort((a, b) => compareByMode(a, b, sort));
  return arr;
}

interface DerivationParts {
  byId: Map<string, EnrichedShelfUnit>;
  childByParent: Map<string, EnrichedShelfUnit[]>;
  childIds: Set<string>;
  roots: EnrichedShelfUnit[];
}

function partition(
  units: EnrichedShelfUnit[],
  relations: ShelfUnitRelationDTO[],
): DerivationParts {
  const byId = new Map<string, EnrichedShelfUnit>();
  for (const e of units) byId.set(e.unit.unitId, e);

  const childByParent = new Map<string, EnrichedShelfUnit[]>();
  const childIds = new Set<string>();
  for (const rel of relations) {
    childIds.add(rel.childUnitId);
    const child = byId.get(rel.childUnitId);
    if (!child) continue;
    let bucket = childByParent.get(rel.parentUnitId);
    if (!bucket) {
      bucket = [];
      childByParent.set(rel.parentUnitId, bucket);
    }
    if (!bucket.includes(child)) bucket.push(child);
  }

  const roots: EnrichedShelfUnit[] = [];
  for (const e of units) {
    if (!childIds.has(e.unit.unitId)) roots.push(e);
  }

  return { byId, childByParent, childIds, roots };
}

/**
 * Pure derivation of the rendered stream from ShelfUnit + ShelfUnitRelation.
 *
 * - Roots = units that do not appear as `childUnitId` in any relation.
 * - In nested mode: returns root entries; consumers render attached children
 *   inside each root via `entry.children`.
 * - In flat/masonry + `sortPrimeOnly=true`: roots sorted first, each root's
 *   children sorted by the same comparator, emitted immediately after the root.
 * - In flat/masonry + `sortPrimeOnly=false`: every ShelfUnit is emitted once as
 *   a peer, all participating in one comparator.
 *
 * Multi-step cycles in the relation graph cannot infinitely recurse because
 * the nested entry shape is one level deep (children only); two-step cycles
 * just render each affected unit under its parent(s) and not as a root.
 */
export function deriveShelfStream(
  units: EnrichedShelfUnit[],
  relations: ShelfUnitRelationDTO[],
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

export function shelfUnitsById(
  units: EnrichedShelfUnit[],
): Map<string, EnrichedShelfUnit> {
  const m = new Map<string, EnrichedShelfUnit>();
  for (const e of units) m.set(e.unit.unitId, e);
  return m;
}

export function findChildren(
  units: EnrichedShelfUnit[],
  relations: ShelfUnitRelationDTO[],
  parentUnitId: string,
  role?: ShelfUnitRelationDTO["role"],
): EnrichedShelfUnit[] {
  const byId = shelfUnitsById(units);
  const out: EnrichedShelfUnit[] = [];
  for (const rel of relations) {
    if (rel.parentUnitId !== parentUnitId) continue;
    if (role && rel.role !== role) continue;
    const child = byId.get(rel.childUnitId);
    if (child && !out.includes(child)) out.push(child);
  }
  return out;
}

// Lightweight rehydration helper for callsites that have a plain unit list and
// need the partition utilities for tests.
export function partitionForTest(
  units: EnrichedShelfUnit[],
  relations: ShelfUnitRelationDTO[],
): { roots: ShelfUnitDTO[]; childIds: Set<string> } {
  const { roots, childIds } = partition(units, relations);
  return {
    roots: roots.map((r) => r.unit),
    childIds,
  };
}
