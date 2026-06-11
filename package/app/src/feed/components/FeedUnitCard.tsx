import type { FeedUnitRow } from "@rezics/api/feed/feed";
import { useTranslation } from "@rezics/i18n/react";
import { Card, CardMedia } from "@rezics/ui/shadcn";
import { BookOpen, Boxes, Film, Gamepad2, Globe2, Layers3 } from "lucide-react";
import type React from "react";
import { AppSafeLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";

interface FeedUnitCardProps {
  row: FeedUnitRow;
  className?: string;
}

const UNIT_TYPE_ICONS: Partial<
  Record<
    FeedUnitRow["unit"]["type"],
    React.ComponentType<{ className?: string }>
  >
> = {
  BOOK: BookOpen,
  GAME: Gamepad2,
  MEDIA: Film,
  REALM: Globe2,
  ZONE: Layers3,
};

function unitTypeLabel(
  type: FeedUnitRow["unit"]["type"],
  t: (key: string) => string,
) {
  switch (type) {
    case "BOOK":
      return t("page:home_feed_type_book");
    case "GAME":
      return t("page:home_feed_type_game");
    case "MEDIA":
      return t("page:home_feed_type_media");
    case "REALM":
      return t("page:home_feed_type_realm");
    case "ZONE":
      return t("page:home_feed_type_zone");
    default:
      return type;
  }
}

export function FeedUnitCard({ row, className }: FeedUnitCardProps) {
  const { t } = useTranslation(["common", "page"]);
  const title = row.unit.title ?? t("common:untitled");
  const description = row.unit.description;
  const typeLabel = unitTypeLabel(row.unit.type, t);
  const Icon = UNIT_TYPE_ICONS[row.unit.type] ?? Boxes;

  return (
    <AppSafeLink
      href={row.href}
      className="block no-underline"
      aria-label={title}
    >
      <Card
        surface="plain"
        interactive
        className={cn(
          "relative w-full gap-0 py-0 transition-[background-color,box-shadow,transform] hover:-translate-y-0.5",
          className,
        )}
      >
        <article className="flex min-w-0 gap-4 p-4">
          <CardMedia className="h-24 w-24 shrink-0 rounded-sm bg-surface-subtle text-text-tertiary">
            {row.unit.coverUrl ? (
              <img
                src={row.unit.coverUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
            )}
          </CardMedia>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="min-w-0">
              <h3 className="m-0 line-clamp-2 text-base font-medium leading-ui text-text-primary">
                {title}
              </h3>
              <p className="mt-1 truncate text-xs leading-dense text-text-tertiary">
                {typeLabel}
              </p>
            </div>

            {description ? (
              <p className="line-clamp-3 text-sm leading-ui text-text-secondary">
                {description}
              </p>
            ) : null}
          </div>
        </article>
      </Card>
    </AppSafeLink>
  );
}
