import type {
  EnrichedShelfItem,
  ShelfSortState,
  ShelfView,
  TagListEntryDTO,
} from "@rezics/api/shelf";
import type { PostDTO, ShelfItemDTO } from "@rezics/contract";
import { titleOf } from "./titleOf";

export type ShelfStreamEntry =
  | { kind: "prime"; enriched: EnrichedShelfItem }
  | {
      kind: "review";
      parentItemRef: string;
      parentItem: ShelfItemDTO;
      review: PostDTO;
    }
  | {
      kind: "tag";
      parentItemRef: string;
      parentItem: ShelfItemDTO;
      tag: TagListEntryDTO;
    };

const titleCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function entryTitle(entry: ShelfStreamEntry): string {
  if (entry.kind === "prime") {
    return titleOf(entry.enriched.item, entry.enriched.primary);
  }
  if (entry.kind === "review") {
    return entry.review.extra?.title ?? entry.parentItemRef;
  }
  return entry.tag.label ?? entry.parentItemRef;
}

function entryTime(entry: ShelfStreamEntry): number {
  if (entry.kind === "prime") {
    const t = entry.enriched.item.createdAt;
    return t ? new Date(t).getTime() : 0;
  }
  if (entry.kind === "review") {
    const t = entry.parentItem.createdAt;
    return t ? new Date(t).getTime() : 0;
  }
  const t = entry.parentItem.createdAt;
  return t ? new Date(t).getTime() : 0;
}

function comparePosition(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function maybeReverse(value: number, order: ShelfSortState["order"]): number {
  return order === "desc" ? -value : value;
}

function compareByOrder(
  a: string,
  b: string,
  order: ShelfSortState["order"],
): number {
  return maybeReverse(comparePosition(a, b), order);
}

function compareTime(
  aTime: number,
  bTime: number,
  order: ShelfSortState["order"],
): number {
  const value = aTime - bTime;
  return order === "desc" ? -value : value;
}

function compareTitle(
  a: string,
  b: string,
  order: ShelfSortState["order"],
): number {
  return maybeReverse(titleCollator.compare(a, b), order);
}

function primeTieBreaker(a: EnrichedShelfItem, b: EnrichedShelfItem): number {
  return (
    comparePosition(a.item.position, b.item.position) ||
    titleCollator.compare(a.item.itemRef, b.item.itemRef)
  );
}

function entryRefId(entry: ShelfStreamEntry): string {
  if (entry.kind === "prime") return entry.enriched.item.itemRef;
  if (entry.kind === "review") return entry.review.unitId;
  return entry.tag.unitId;
}

function entryParentRef(entry: ShelfStreamEntry): string {
  if (entry.kind === "prime") return entry.enriched.item.itemRef;
  return entry.parentItemRef;
}

function entryTieBreaker(a: ShelfStreamEntry, b: ShelfStreamEntry): number {
  const parentCompare = titleCollator.compare(
    entryParentRef(a),
    entryParentRef(b),
  );
  if (parentCompare !== 0) return parentCompare;
  return titleCollator.compare(entryRefId(a), entryRefId(b));
}

function comparePrimeByMode(
  a: EnrichedShelfItem,
  b: EnrichedShelfItem,
  sort: ShelfSortState,
): number {
  if (sort.field === "manual") {
    return (
      compareByOrder(a.item.position, b.item.position, sort.order) ||
      titleCollator.compare(a.item.itemRef, b.item.itemRef)
    );
  }
  if (sort.field === "addedAt") {
    const aT = a.item.createdAt ? new Date(a.item.createdAt).getTime() : 0;
    const bT = b.item.createdAt ? new Date(b.item.createdAt).getTime() : 0;
    return compareTime(aT, bT, sort.order) || primeTieBreaker(a, b);
  }
  return (
    compareTitle(
      titleOf(a.item, a.primary),
      titleOf(b.item, b.primary),
      sort.order,
    ) || primeTieBreaker(a, b)
  );
}

function compareEntryByMode(
  a: ShelfStreamEntry,
  b: ShelfStreamEntry,
  sort: ShelfSortState,
): number {
  if (sort.field === "manual") {
    // Reviews have no position of their own; manual sort keeps prime order
    // with reviews pinned adjacent to their prime. Callers that reach this
    // branch have already flattened, so fall back to a stable comparison.
    if (a.kind === "prime" && b.kind === "prime") {
      return (
        compareByOrder(
          a.enriched.item.position,
          b.enriched.item.position,
          sort.order,
        ) || entryTieBreaker(a, b)
      );
    }
    return entryTieBreaker(a, b);
  }
  if (sort.field === "addedAt") {
    return (
      compareTime(entryTime(a), entryTime(b), sort.order) ||
      entryTieBreaker(a, b)
    );
  }
  return (
    compareTitle(entryTitle(a), entryTitle(b), sort.order) ||
    entryTieBreaker(a, b)
  );
}

function sortedPrimes(
  enriched: EnrichedShelfItem[],
  sort: ShelfSortState,
): EnrichedShelfItem[] {
  const arr = [...enriched];
  arr.sort((a, b) => comparePrimeByMode(a, b, sort));
  return arr;
}

export function deriveShelfStream(
  enriched: EnrichedShelfItem[],
  mode: ShelfView,
  sort: ShelfSortState,
  sortPrimeOnly: boolean,
): ShelfStreamEntry[] {
  if (mode === "nested") {
    return sortedPrimes(enriched, sort).map((e) => ({
      kind: "prime" as const,
      enriched: e,
    }));
  }

  if (sort.field === "manual" || sortPrimeOnly) {
    const out: ShelfStreamEntry[] = [];
    for (const e of sortedPrimes(enriched, sort)) {
      out.push({ kind: "prime", enriched: e });
      for (const review of e.attachedReviews) {
        out.push({
          kind: "review",
          parentItemRef: e.item.itemRef,
          parentItem: e.item,
          review,
        });
      }
      for (const tag of e.attachedTags) {
        out.push({
          kind: "tag",
          parentItemRef: e.item.itemRef,
          parentItem: e.item,
          tag,
        });
      }
    }
    return out;
  }

  const flat: ShelfStreamEntry[] = [];
  for (const e of enriched) {
    flat.push({ kind: "prime", enriched: e });
    for (const review of e.attachedReviews) {
      flat.push({
        kind: "review",
        parentItemRef: e.item.itemRef,
        parentItem: e.item,
        review,
      });
    }
    for (const tag of e.attachedTags) {
      flat.push({
        kind: "tag",
        parentItemRef: e.item.itemRef,
        parentItem: e.item,
        tag,
      });
    }
  }
  flat.sort((a, b) => compareEntryByMode(a, b, sort));
  return flat;
}
