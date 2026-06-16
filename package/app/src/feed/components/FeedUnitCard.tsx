import type { FeedUnitRow } from "@rezics/api/feed/feed";
import { useTranslation } from "@rezics/i18n/react";
import { Card, CardMedia } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, Boxes, Film, Gamepad2, Globe2, Layers3 } from "lucide-react";
import type React from "react";
import { type Action, ReactionBar, type ReactionBarPolicy } from "@/engagement";
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

function shelfKindForUnit(
  type: FeedUnitRow["unit"]["type"],
): ReactionBarPolicy["shelfItemKind"] {
  switch (type) {
    case "BOOK":
      return "book";
    case "GAME":
      return "game";
    case "MEDIA":
      return "media";
    case "TAG":
      return "tag";
    default:
      return undefined;
  }
}

/**
 * Feed unit card：统一 Unit 推荐项。封面固定，正文列 `min-w-0 flex-1`
 * 吸收宽度变化；窄屏截断标题，宽屏由 feed 容器决定最终宽度。
 *
 * Mobile (<640px)
 * +------------------------------+
 * | [icon] Unit title       Type |
 * |        Summary lines         |
 * |        (flex spacer)         |
 * |        [vote][shelf][share]  |
 * +------------------------------+
 *
 * Tablet (640px-1023px)
 * +--------------------------------------+
 * | [cover] Title / type                 |
 * |         Summary; reaction row bottom |
 * +--------------------------------------+
 *
 * Desktop (1024px-1535px)
 * +------------------------------------------------+
 * | [cover] Content stretches, controls stay bottom |
 * +------------------------------------------------+
 *
 * Ultra-wide (>=1536px)
 * +----------------------------------------------------------+
 * | [cover] Card remains full-width within feed constraints   |
 * +----------------------------------------------------------+
 */
export function FeedUnitCard({ row, className }: FeedUnitCardProps) {
  const { t } = useTranslation(["book", "common", "page"]);
  const navigate = useNavigate();
  const title = row.unit.title ?? t("common:untitled");
  const description = row.unit.description;
  const typeLabel = unitTypeLabel(row.unit.type, t);
  const Icon = UNIT_TYPE_ICONS[row.unit.type] ?? Boxes;
  const isBook = row.unit.type === "BOOK";
  const actions: Action[] = isBook
    ? ["vote", "reply", "shelf", "share"]
    : ["vote", "shelf", "share"];
  const reactionPolicy: ReactionBarPolicy = {
    getShareHref: () => row.href,
    shelfItemKind: shelfKindForUnit(row.unit.type),
  };

  const openUnit = () => {
    navigate({ to: row.href });
  };

  const handleCardKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openUnit();
  };

  const openRemarks = () => {
    if (!isBook) return;
    navigate({
      to: "/book/$bookId/info",
      params: { bookId: row.unit.unitId },
      search: { focus: "remark" },
    });
  };

  return (
    <Card
      surface="plain"
      interactive
      role="link"
      tabIndex={0}
      aria-label={title}
      onClick={openUnit}
      onKeyDown={handleCardKeyDown}
      className={cn(
        "relative w-full gap-0 py-0 transition-[background-color,box-shadow,transform] hover:-translate-y-0.5",
        className,
      )}
    >
      <article className="flex min-w-0 items-stretch gap-4 p-4">
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

          <ReactionBar
            size="md"
            variant="pill"
            post={{ unitId: row.unit.unitId }}
            policy={reactionPolicy}
            actions={actions}
            replyMode="label"
            replyLabel={isBook ? t("book:remark") : undefined}
            onReplyInvoke={openRemarks}
            className="mt-auto pt-2"
          />
        </div>
      </article>
    </Card>
  );
}
