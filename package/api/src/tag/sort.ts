/**
 * Pin-first then score-desc ordering helpers.
 *
 * The server returns tag-relation rows already ordered, but client-side
 * mutations (optimistic updates, local insertions, manual filtering) can
 * leave a list in an undefined order. These helpers re-apply the canonical
 * order so the UI is stable: pinned rows first by ascending fractional
 * `position`, then unpinned rows by descending `score`, with `tagUnitId`
 * as the deterministic tiebreaker.
 */

import type { RealmTagUnitDTO, UnitTagDTO } from "@rezics/contract";

type PinnableTagRow = {
  pinned?: boolean;
  position?: string | null;
  score?: number;
  tagUnitId?: string;
};

function comparePinThenScore(a: PinnableTagRow, b: PinnableTagRow): number {
  const aPinned = a.pinned === true;
  const bPinned = b.pinned === true;
  if (aPinned !== bPinned) return aPinned ? -1 : 1;

  if (aPinned && bPinned) {
    const aPos = a.position ?? "";
    const bPos = b.position ?? "";
    if (aPos !== bPos) return aPos < bPos ? -1 : 1;
  }

  const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
  if (scoreDiff !== 0) return scoreDiff;

  const aTag = a.tagUnitId ?? "";
  const bTag = b.tagUnitId ?? "";
  if (aTag < bTag) return -1;
  if (aTag > bTag) return 1;
  return 0;
}

export function sortTagsByPinThenScore<T extends UnitTagDTO>(rows: T[]): T[] {
  return [...rows].sort(comparePinThenScore);
}

export function sortRealmTagsByPinThenScore<T extends RealmTagUnitDTO>(
  rows: T[],
): T[] {
  return [...rows].sort(comparePinThenScore);
}
