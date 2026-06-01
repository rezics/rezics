import type { BookshelfViewConfig } from "@rezics/contract";
import { BookshelfGrid } from "@/bookshelf-view";
import type { BookshelfItem } from "@/bookshelf-view";

export interface DashboardLibraryShelfBlockProps {
  items: readonly BookshelfItem[];
  config: BookshelfViewConfig;
}

/**
 * Renders dashboard progress rows through the shared bookshelf view. Shelf
 * membership is deliberately not fetched here; progress owns this surface.
 */
export function DashboardLibraryShelfBlock({
  items,
  config,
}: DashboardLibraryShelfBlockProps) {
  if (items.length === 0) return null;

  return <BookshelfGrid items={items} config={config} />;
}
