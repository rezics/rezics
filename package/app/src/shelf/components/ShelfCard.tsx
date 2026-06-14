import {
  contentDocMarkdownFallback,
  type ShelfDTO,
  shelfCoverImageSpec,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Badge, Card, CardContent } from "@rezics/ui/shadcn";
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
  const { t } = useTranslation(["common", "entity"]);
  const shelfId = shelf.unitId ?? (shelf as ShelfCardLinkable).id;
  const translation = getTranslation(shelf.translations);
  const title = translation?.title || "";
  const description = contentDocMarkdownFallback(translation?.description);
  const itemsCount =
    shelf.itemCount ?? (shelf as { items?: unknown[] }).items?.length ?? 0;

  const card = (
    <Card
      surface="plain"
      className={cn("gap-0 py-0", shelfId && "cursor-pointer", className)}
    >
      <div
        className="relative w-full overflow-hidden border-b border-border-whisper"
        style={{ aspectRatio: shelfCoverImageSpec.aspectRatio }}
      >
        {shelf.coverUrl ? (
          <img
            src={shelf.coverUrl}
            alt={t("entity:shelf_cover_alt", {
              title: title || t("entity:shelf_untitled"),
            })}
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
              {t("entity:shelf_items_count", { count: itemsCount })}
            </span>
          </div>
        )}
      </div>

      <CardContent className="px-4 pb-4 pt-3">
        <h3 className="truncate text-lg font-semibold">
          {title || t("entity:shelf_untitled")}
        </h3>

        <p className="mt-1 line-clamp-2 min-h-[2.8em] text-sm leading-[1.4] text-text-secondary">
          {description || t("entity:shelf_no_description")}
        </p>

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-xs text-text-secondary">
            {t("entity:shelf_items_count", { count: itemsCount })}
          </span>
          <span
            className="whitespace-nowrap text-xs text-text-brand"
            style={{ lineHeight: 1 }}
          >
            {shelf.user?.name || t("common:anonymous")}
          </span>
        </div>
        {shelf.matchedUnit?.unitId && (
          <div className="mt-2">
            <Badge variant="outline" className="max-w-full truncate">
              {shelf.matchedUnit.title ?? shelf.matchedUnit.unitId}
            </Badge>
          </div>
        )}
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
