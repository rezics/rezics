import type { FeedShelfRow } from "@rezics/api/feed/feed";
import { useTranslation } from "@rezics/i18n/react";
import { Card, CardMedia } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { Library } from "lucide-react";
import type React from "react";
import { ReactionBar, type ReactionBarPolicy } from "@/engagement";
import { cn } from "@/shared/utils/css-util";

const feedShelfActions = ["vote", "shelf", "share"] as const;

const feedShelfReactionPolicy: ReactionBarPolicy = {
  getShareHref: (post) => `/shelf/${post.unitId}`,
  shelfItemKind: "shelf",
};

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

/**
 * Feed shelf card：列表中的书架推荐项。封面横向固定，正文 `min-w-0`
 * 负责标题截断，reaction row 是独立交互区，不触发卡片打开。
 *
 * Mobile (<640px)
 * +------------------------------+
 * | [cover] Shelf title          |
 * |         Item count           |
 * |         Shelf kind           |
 * |         (flex spacer)        |
 * |         [vote][shelf][share] |
 * +------------------------------+
 *
 * Tablet (640px-1023px)
 * +--------------------------------------+
 * | [cover] Title two lines max          |
 * |         Count / kind; footer bottom  |
 * +--------------------------------------+
 *
 * Desktop (1024px-1535px)
 * +------------------------------------------------+
 * | [cover] Content stretches, action row bottom   |
 * +------------------------------------------------+
 *
 * Ultra-wide (>=1536px)
 * +----------------------------------------------------------+
 * | [cover] Width comes from feed container, not content size |
 * +----------------------------------------------------------+
 */
export function FeedShelfCard({ row, className }: FeedShelfCardProps) {
  const { t } = useTranslation(["common", "entity"]);
  const navigate = useNavigate();
  const title = row.shelf.title ?? t("entity:shelf_untitled");

  const openShelf = () => {
    navigate({ to: row.href });
  };

  const handleCardKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openShelf();
  };

  return (
    <Card
      surface="plain"
      interactive
      role="link"
      tabIndex={0}
      aria-label={title}
      onClick={openShelf}
      onKeyDown={handleCardKeyDown}
      className={cn(
        "relative w-full gap-0 py-0 transition-[background-color,box-shadow,transform] hover:-translate-y-0.5",
        className,
      )}
    >
      <article className="flex min-w-0 items-stretch gap-4 p-4">
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

          <ReactionBar
            size="md"
            variant="pill"
            post={{ unitId: row.shelf.unitId }}
            policy={feedShelfReactionPolicy}
            actions={[...feedShelfActions]}
            className="mt-auto pt-2"
          />
        </div>
      </article>
    </Card>
  );
}
