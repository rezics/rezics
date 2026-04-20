import type {
  EnrichedShelfItem,
  ShelfSortMode,
  ShelfView,
} from "@rezics/api/shelf";
import type { PostDTO } from "@rezics/contract";
import { titleOf } from "./titleOf";

export type ShelfStreamEntry =
  | { kind: "prime"; enriched: EnrichedShelfItem }
  | {
      kind: "review";
      parentItemRef: string;
      review: PostDTO;
    };

const titleCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function entryTitle(entry: ShelfStreamEntry): string {
  if (entry.kind === "prime") {
    return titleOf(entry.enriched.item, entry.enriched.primary);
  }
  return entry.review.extra?.title ?? entry.parentItemRef;
}

function entryTime(entry: ShelfStreamEntry): number {
  if (entry.kind === "prime") {
    const t = entry.enriched.item.createdAt;
    return t ? new Date(t).getTime() : 0;
  }
  const t = entry.review.createdAt;
  return t ? new Date(t).getTime() : 0;
}

function comparePrimeByMode(
  a: EnrichedShelfItem,
  b: EnrichedShelfItem,
  mode: ShelfSortMode,
): number {
  if (mode === "manual") {
    return a.item.position < b.item.position ? -1 : 1;
  }
  if (mode === "time") {
    const aT = a.item.createdAt ? new Date(a.item.createdAt).getTime() : 0;
    const bT = b.item.createdAt ? new Date(b.item.createdAt).getTime() : 0;
    return bT - aT;
  }
  return titleCollator.compare(
    titleOf(a.item, a.primary),
    titleOf(b.item, b.primary),
  );
}

function compareEntryByMode(
  a: ShelfStreamEntry,
  b: ShelfStreamEntry,
  mode: ShelfSortMode,
): number {
  if (mode === "manual") {
    // Reviews have no position of their own; manual sort keeps prime order
    // with reviews pinned adjacent to their prime. Callers that reach this
    // branch have already flattened, so fall back to a stable comparison.
    if (a.kind === "prime" && b.kind === "prime") {
      return a.enriched.item.position < b.enriched.item.position ? -1 : 1;
    }
    return 0;
  }
  if (mode === "time") {
    return entryTime(b) - entryTime(a);
  }
  return titleCollator.compare(entryTitle(a), entryTitle(b));
}

function sortedPrimes(
  enriched: EnrichedShelfItem[],
  mode: ShelfSortMode,
): EnrichedShelfItem[] {
  const arr = [...enriched];
  arr.sort((a, b) => comparePrimeByMode(a, b, mode));
  return arr;
}

export function deriveShelfStream(
  enriched: EnrichedShelfItem[],
  mode: ShelfView,
  sort: ShelfSortMode,
  sortPrimeOnly: boolean,
): ShelfStreamEntry[] {
  if (mode === "nested") {
    return sortedPrimes(enriched, sort).map((e) => ({
      kind: "prime" as const,
      enriched: e,
    }));
  }

  if (sort === "manual" || sortPrimeOnly) {
    const out: ShelfStreamEntry[] = [];
    for (const e of sortedPrimes(enriched, sort)) {
      out.push({ kind: "prime", enriched: e });
      for (const review of e.attachedReviews) {
        out.push({
          kind: "review",
          parentItemRef: e.item.itemRef,
          review,
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
        review,
      });
    }
  }
  flat.sort((a, b) => compareEntryByMode(a, b, sort));
  return flat;
}
