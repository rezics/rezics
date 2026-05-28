import type React from "react";
import { Link } from "@/shared/ui/link";
import type { BookshelfItem } from "../models/types";

export interface BookshelfHoverPanelProps {
  item: BookshelfItem;
}

/**
 * Desktop-only hover preview shown when a viewer hovers a bookshelf cover.
 * Renders richer metadata and a direct link to the item's detail page.
 */
export const BookshelfHoverPanel: React.FC<BookshelfHoverPanelProps> = ({
  item,
}) => {
  return (
    <div className="w-64 rounded-md border border-border-whisper bg-surface-raised p-3 shadow-lg">
      <div className="flex gap-3">
        <img
          src={item.coverUrl}
          alt={item.title}
          className="h-24 w-16 flex-none rounded object-cover"
          loading="lazy"
        />
        <div className="min-w-0">
          <Link
            to={item.href}
            className="line-clamp-2 text-sm font-semibold text-text-primary hover:underline"
          >
            {item.title}
          </Link>
          {item.author ? (
            <div className="mt-1 line-clamp-1 text-xs text-text-secondary">
              {item.author}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
