import type { FeedUnitRow } from "@rezics/api/feed/feed";
import {
  CATALOG_UNIT_COVER_ASPECT_RATIO_BY_TYPE,
  isCatalogUnitType,
} from "@rezics/contract";
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
 * Feed unit card：统一 Unit 推荐项。BOOK/GAME/MEDIA 使用 catalog cover
 * contract 固定封面比例，封面框 `self-start` 避免被右侧内容高度拉伸，
 * 图片 `object-fit: contain` 保持原比例；其他 Unit 使用图标/图片框。
 * 正文列 `min-w-0 flex-1` 吸收宽度变化；窄屏截断标题，宽屏由 feed
 * 容器决定最终宽度。
 *
 * Mobile (<640px)
 * +------------------------------+
 * | [cover 96px] Title     Type |
 * |        Summary lines         |
 * |        (flex spacer)         |
 * |        [vote][shelf][share]  |
 * +------------------------------+
 *
 * Tablet (640px-1023px)
 * +--------------------------------------+
 * | [cover 112px] Title / type           |
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
  const catalogCoverAspectRatio = isCatalogUnitType(row.unit.type)
    ? CATALOG_UNIT_COVER_ASPECT_RATIO_BY_TYPE[row.unit.type]
    : null;
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
        <CardMedia
          className={cn(
            "shrink-0 rounded-sm bg-surface-subtle text-text-tertiary",
            catalogCoverAspectRatio ? "w-24 self-start sm:w-28" : "h-24 w-24",
          )}
          style={
            catalogCoverAspectRatio
              ? { aspectRatio: catalogCoverAspectRatio }
              : undefined
          }
        >
          {row.unit.coverUrl ? (
            <img
              src={row.unit.coverUrl}
              alt=""
              loading="lazy"
              className={cn(
                "h-full w-full",
                !catalogCoverAspectRatio && "object-cover",
              )}
              style={
                catalogCoverAspectRatio ? { objectFit: "contain" } : undefined
              }
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
