import type { LibraryKind } from "@rezics/contract";

/** A single library item rendered in the bookshelf grid. */
export interface BookshelfItem {
  unitId: string;
  kind: LibraryKind;
  title: string;
  coverUrl: string;
  author?: string;
  /** Books only: whether the viewer can actually open/read the item. */
  isLicensed?: boolean;
  href: string;
}
