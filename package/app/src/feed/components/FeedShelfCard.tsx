import type { FeedShelfRow } from "@rezics/api/feed/feed";
import { useTranslation } from "@rezics/i18n/react";
import { Card, CardMedia } from "@rezics/ui/shadcn";
import { Library } from "lucide-react";
import { AppSafeLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";

function shelfKindLabel(kindKey: string, t: (key: string) => string): string {
  switch (kindKey) {
    case "favorites":
      return t("entity:shelf_system_favorites");
    case "saved":
      return t("entity:shelf_system_saved");
    case "backlog":
      return t("entity:shelf_system_backlog");
    case "active":
      return t("entity:shelf_system_active");
    case "completed":
      return t("entity:shelf_system_completed");
    case "CUSTOM":
      return t("entity:shelf_kind_custom");
    case "FAVORITES":
      return t("entity:shelf_kind_favorites");
    case "PLAYLIST":
      return t("entity:shelf_kind_playlist");
    case "READING_LIST":
      return t("entity:shelf_kind_reading_list");
    case "WATCHLIST":
      return t("entity:shelf_kind_watchlist");
    default:
      return kindKey
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

interface FeedShelfCardProps {
  row: FeedShelfRow;
  className?: string;
}

export function FeedShelfCard({ row, className }: FeedShelfCardProps) {
  const { t } = useTranslation(["common", "entity"]);
  const title = row.shelf.title ?? t("entity:shelf_untitled");

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
          <CardMedia className="h-28 w-36 shrink-0 rounded-sm bg-surface-subtle text-text-tertiary">
            {row.shelf.coverUrl ? (
              <img
                src={row.shelf.coverUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Library className="h-5 w-5" aria-hidden />
              </div>
            )}
          </CardMedia>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="min-w-0">
              <h3 className="m-0 line-clamp-2 text-base font-medium leading-ui text-text-primary">
                {title}
              </h3>
              <p className="mt-1 truncate text-xs leading-dense text-text-tertiary">
                {t("entity:shelf_items_count", { count: row.shelf.itemCount })}
              </p>
            </div>

            {row.shelf.kindKey ? (
              <p className="line-clamp-2 text-sm leading-ui text-text-secondary">
                {shelfKindLabel(row.shelf.kindKey, t)}
              </p>
            ) : null}
          </div>
        </article>
      </Card>
    </AppSafeLink>
  );
}
