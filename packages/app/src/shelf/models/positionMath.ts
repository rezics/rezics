import { generateKeyBetween } from "@rezics/api/shared/fractional-index";
import type { ShelfSortOrder } from "@rezics/api/shelf";

export interface PositionedShelfRow {
  position: string;
}

export interface ReorderBounds {
  before?: string;
  after?: string;
}

export function appendAfter(last: string | undefined): string {
  return generateKeyBetween(last, undefined);
}

export function prependBefore(first: string | undefined): string {
  return generateKeyBetween(undefined, first);
}

export function betweenNeighbors(
  before: string | undefined,
  after: string | undefined,
): string {
  return generateKeyBetween(before, after);
}

export function visualReorderBounds<T extends PositionedShelfRow>(
  visualRows: readonly T[],
  targetIndex: number,
  order: ShelfSortOrder,
): ReorderBounds {
  const prev = targetIndex > 0 ? visualRows[targetIndex - 1] : undefined;
  const next =
    targetIndex < visualRows.length - 1
      ? visualRows[targetIndex + 1]
      : undefined;

  if (order === "desc") {
    return {
      before: next?.position,
      after: prev?.position,
    };
  }

  return {
    before: prev?.position,
    after: next?.position,
  };
}
