export {
  aspectRatioForKind,
  columnsForWidth,
  resolveBookshelfConfig,
} from "./resolveBookshelfConfig";
export type { BookshelfItem } from "./types";

/**
 * Filter to items the viewer can actually open. Only books are gated by
 * `isLicensed`; non-book library kinds (game, media) are always kept.
 */
export function applyReadableFilter<
  T extends { kind: string; isLicensed?: boolean },
>(items: readonly T[], enabled: boolean): T[] {
  if (!enabled) return [...items];
  return items.filter((item) =>
    item.kind === "book" ? item.isLicensed === true : true,
  );
}
