import type { ShelfDTO } from "@rezics/contract";
import { Card, CardContent } from "@rezics/ui/shadcn";
import { Link } from "@tanstack/react-router";
import type React from "react";
import { cn } from "@/shared/utils/css-util";
import { getTranslation } from "@/shared/utils/translation-helpers";

interface ShelfCardProps {
  shelf: ShelfDTO;
  className?: string;
}

type ShelfCardLinkable = ShelfDTO & {
  id?: string | null;
};

export const ShelfCard: React.FC<ShelfCardProps> = ({ shelf, className }) => {
  const shelfId = shelf.unitId ?? (shelf as ShelfCardLinkable).id;
  const translation = getTranslation(shelf.translations);
  const title = translation?.title ?? "";
  const description = translation?.description ?? "";
  const itemsCount = shelf.itemCount ?? shelf.items?.length ?? 0;

  const card = (
    <Card
      className={cn(
        "gap-0 overflow-hidden rounded-md border-0 py-0 shadow-none ring-0",
        shelfId && "cursor-pointer",
        className,
      )}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-border-whisper">
        {shelf.coverUrl ? (
          <img
            src={shelf.coverUrl}
            alt={title || "Shelf cover"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, var(--colors-surface-subtle, rgba(0,0,0,0.04)), var(--colors-surface-canvas, transparent))",
            }}
          >
            <span className="text-xs text-text-secondary">
              {itemsCount} items
            </span>
          </div>
        )}
      </div>

      <CardContent className="px-4 pb-4 pt-3">
        <h3 className="truncate text-lg font-semibold">
          {title || "Untitled Shelf"}
        </h3>

        <p className="mt-1 line-clamp-2 min-h-[2.8em] text-sm leading-[1.4] text-text-secondary">
          {description || "No description"}
        </p>

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-xs text-text-secondary">
            {itemsCount} items
          </span>
          <span
            className="whitespace-nowrap text-xs text-text-brand"
            style={{ lineHeight: 1 }}
          >
            {shelf.user?.name || "Anonymous"}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  if (!shelfId) {
    return card;
  }

  return (
    <Link
      to="/shelf/$shelfId"
      params={{ shelfId }}
      className="block no-underline"
    >
      {card}
    </Link>
  );
};
