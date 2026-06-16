import type { FeedBookRow } from "@rezics/api/feed/feed";
import {
  CATALOG_UNIT_COVER_ASPECT_RATIO_BY_TYPE,
  UnitType,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Badge, Card, CardMedia } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import type React from "react";
import { ReactionBar, type ReactionBarPolicy } from "@/engagement";
import { cn } from "@/shared/utils/css-util";

const feedBookActions = ["vote", "reply", "shelf", "share"] as const;

const feedBookReactionPolicy: ReactionBarPolicy = {
  getShareHref: (post) => `/book/${post.unitId}`,
  shelfItemKind: "book",
};

function bookKindLabel(kind: string, t: (key: string) => string): string {
  switch (kind) {
    case "book":
      return t("page:home_feed_type_book");
    case "game":
      return t("page:home_feed_type_game");
    case "media":
      return t("page:home_feed_type_media");
    default:
      return kind;
  }
}

interface FeedBookCardProps {
  row: FeedBookRow;
  className?: string;
}

/**
 * Feed book card：列表中的作品推荐项，封面负责第一识别，右上角 badge 只
 * 标注 kind。封面比例来自 catalog Unit contract，封面框 `self-start`
 * 避免被右侧内容高度拉伸；图片 `object-fit: contain` 保持原比例，允许
 * 留白。窄屏时封面固定宽度、正文 `min-w-0` 截断；宽屏时正文伸展、
 * card 保持 `w-full`，右上角 badge 固定不挤压标题。
 *
 * Mobile (<640px)
 * +--------------------------------+
 * | [cover 96px] Title line [Book]|
 * |         Subtitle line          |
 * |         Author                 |
 * |         #tag #tag #tag         |
 * |         Summary line line      |
 * |         (flex spacer)          |
 * |         [vote][remark][shelf]  |
 * +--------------------------------+
 *
 * Tablet (640px-1023px)
 * +------------------------------------------+
 * | [cover 112px] Title two lines      [Book]|
 * |         Subtitle / Author                |
 * |         #tag #tag #tag #tag #tag         |
 * |         Summary clamped to 3 lines        |
 * |         Footer anchored to card bottom    |
 * |         [vote] [remark] [shelf] [share]  |
 * +------------------------------------------+
 *
 * Desktop (1024px-1535px)
 * +----------------------------------------------------+
 * | [cover] Title and metadata fill row          [Book]|
 * |         Tags wrap inside content width              |
 * |         Summary scans before the reaction row        |
 * |         Reaction bar stays left at bottom edge       |
 * +----------------------------------------------------+
 *
 * Ultra-wide (>=1536px)
 * +--------------------------------------------------------------+
 * | [cover] Content column stretches; badge remains top-right    |
 * |         Text maxes by feed container, no content-sized width  |
 * |         Reaction row is stable and never triggers card open   |
 * +--------------------------------------------------------------+
 */
export function FeedBookCard({ row, className }: FeedBookCardProps) {
  const { t } = useTranslation(["book", "common", "page"]);
  const navigate = useNavigate();
  const title = row.book.title ?? t("common:untitled");
  const subtitle = row.book.subtitle;
  const description = row.book.description;
  const primaryAuthor = row.book.primaryAuthor?.name;
  const tags = row.book.tags ?? [];
  const kindLabel = row.book.kind ? bookKindLabel(row.book.kind, t) : null;

  const openBook = () => {
    navigate({ to: row.href });
  };

  const handleCardKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openBook();
  };

  const openRemarks = () => {
    navigate({
      to: "/book/$bookId/info",
      params: { bookId: row.book.unitId },
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
      onClick={openBook}
      onKeyDown={handleCardKeyDown}
      className={cn(
        "relative w-full gap-0 py-0 transition-[background-color,box-shadow,transform] hover:-translate-y-0.5",
        className,
      )}
    >
      {kindLabel ? (
        <Badge
          variant="secondary"
          className="absolute right-3 top-3 z-10 max-w-24 truncate"
          title={kindLabel}
        >
          {kindLabel}
        </Badge>
      ) : null}

      <article className="flex min-w-0 items-stretch gap-4 p-4 pr-16">
        <CardMedia
          className="w-24 shrink-0 self-start rounded-sm bg-surface-subtle text-text-tertiary sm:w-28"
          style={{
            aspectRatio: CATALOG_UNIT_COVER_ASPECT_RATIO_BY_TYPE[UnitType.BOOK],
          }}
        >
          {row.book.coverUrl ? (
            <img
              src={row.book.coverUrl}
              alt=""
              loading="lazy"
              className="h-full w-full"
              style={{ objectFit: "contain" }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <BookOpen className="h-5 w-5" aria-hidden />
            </div>
          )}
        </CardMedia>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="min-w-0">
            <h3 className="m-0 line-clamp-2 text-base font-medium leading-ui text-text-primary">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-1 line-clamp-1 text-sm leading-ui text-text-secondary">
                {subtitle}
              </p>
            ) : null}
            {primaryAuthor ? (
              <p className="mt-1 truncate text-xs leading-dense text-text-tertiary">
                {primaryAuthor}
              </p>
            ) : null}
          </div>

          {tags.length > 0 ? (
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {tags.slice(0, 5).map((tag) => (
                <Badge
                  key={tag.unitId}
                  variant="outline"
                  className="max-w-30 truncate px-1.5 py-0 text-xs leading-dense text-text-secondary"
                  title={tag.label}
                >
                  {tag.label}
                </Badge>
              ))}
            </div>
          ) : null}

          {description ? (
            <p className="line-clamp-3 text-sm leading-ui text-text-secondary">
              {description}
            </p>
          ) : null}

          <ReactionBar
            size="md"
            variant="pill"
            post={{ unitId: row.book.unitId }}
            policy={feedBookReactionPolicy}
            actions={[...feedBookActions]}
            replyMode="label"
            replyLabel={t("book:remark")}
            onReplyInvoke={openRemarks}
            className="mt-auto pt-2"
          />
        </div>
      </article>
    </Card>
  );
}
