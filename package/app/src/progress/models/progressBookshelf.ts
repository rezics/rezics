import {
  type LibraryKind,
  type ProgressLibraryRow,
  UnitType,
} from "@rezics/contract";
import type { BookshelfItem } from "@/bookshelf-view";
import { resumeRouteToHref } from "./resumeRoute";

function libraryKindFromUnitType(unitType: UnitType): LibraryKind | null {
  if (unitType === UnitType.BOOK) return "book";
  if (unitType === UnitType.GAME) return "game";
  if (unitType === UnitType.MEDIA) return "media";
  return null;
}

export function progressLibraryRowToBookshelfItem(
  row: ProgressLibraryRow,
): BookshelfItem | null {
  const kind = libraryKindFromUnitType(row.progressUnit.unitType);
  if (!kind) return null;

  const item: BookshelfItem = {
    unitId: row.progressUnit.unitId,
    kind,
    title: row.progressUnit.title || row.progressUnit.unitId,
    coverUrl: row.progressUnit.coverUrl ?? "",
    href: row.resumeRoute
      ? resumeRouteToHref(row.resumeRoute)
      : kind === "book"
        ? `/book/${row.progressUnit.unitId}`
        : `/unit/${row.progressUnit.unitId}`,
    isLicensed: true,
  };
  if (kind === "book" && row.progress.completedCount > 0) {
    item.chaptersCompleted = row.progress.completedCount;
  }
  return item;
}
