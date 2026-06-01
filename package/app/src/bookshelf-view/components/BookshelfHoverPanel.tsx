import { useTranslation } from "@rezics/i18n/react";
import { BookOpen } from "lucide-react";
import type React from "react";
import { Link } from "@/shared/ui/link";
import type { BookshelfItem } from "../models/types";

export interface BookshelfHoverPanelProps {
  item: BookshelfItem;
}

/**
 * Desktop-only hover preview shown when a viewer hovers a bookshelf cover.
 * Renders richer metadata, the viewer's reading progress when known, and a
 * direct link to the item's detail page.
 */
export const BookshelfHoverPanel: React.FC<BookshelfHoverPanelProps> = ({
  item,
}) => {
  const { t } = useTranslation(["page"]);
  // Show the progress line only when the book has countable chapters; never a
  // "0/0" placeholder.
  const hasProgress = item.chaptersTotal != null && item.chaptersTotal > 0;
  const hasCover = item.coverUrl.trim().length > 0;

  return (
    <div className="w-64 rounded-md border border-border-whisper bg-surface-elevated p-3 text-text-primary shadow-lg">
      <div className="flex gap-3">
        {hasCover ? (
          <img
            src={item.coverUrl}
            alt={item.title}
            className="h-24 w-16 flex-none rounded object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-24 w-16 flex-none items-center justify-center rounded bg-surface-subtle text-text-tertiary"
            aria-hidden="true"
          >
            <BookOpen className="h-6 w-6" />
          </div>
        )}
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
          {hasProgress ? (
            <div className="mt-1 text-xs text-text-secondary">
              {t("page:dashboard_chapters_progress", {
                completed: item.chaptersCompleted ?? 0,
                total: item.chaptersTotal,
              })}
              {item.lastReadChapterTitle ? (
                <span className="line-clamp-1 text-text-tertiary">
                  {item.lastReadChapterTitle}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
