import type { BatchTagTranslationResult, UnitTagDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import {
  ArrowBigDown,
  ArrowBigUp,
  Info,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { TextLink, unitHref } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";

export type TagVoteChipRow = Pick<
  UnitTagDTO,
  "tagUnitId" | "score" | "voteCount" | "viewerVote"
>;

export type TagVoteChipGroupProps = {
  tags: TagVoteChipRow[];
  translations: BatchTagTranslationResult;
  emptyText: string;
  className?: string;
  votePending?: boolean;
  onVote: (tagUnitId: string, value: 1 | -1) => void;
  onWithdraw: (tagUnitId: string) => void;
  onEditTags?: () => void;
};

/**
 * 可复用 tag 投票 chip 组。标签以 flex-wrap badge 流式排列，chip 本体只展示
 * tag 名与右侧分数，点击单个 chip 后打开 popover；窄屏 popover 内按钮使用
 * 三列紧凑布局，图标固定、文字可截断。
 *
 * Mobile
 * +------------------------------+
 * | [tag score] [long tag wraps] |
 * | popover: title + stats       |
 * | [arrow up] [arrow down] [undo] |
 * | [definition full width]      |
 * +------------------------------+
 *
 * Tablet
 * +------------------------------------------+
 * | chips wrap across available width        |
 * | popover remains anchored to clicked chip |
 * +------------------------------------------+
 *
 * Desktop
 * +------------------------------------------------+
 * | dense chip cloud; vote color visible in-place  |
 * +------------------------------------------------+
 *
 * Ultra-wide
 * +------------------------------------------------+
 * | parent max width controls row length          |
 * +------------------------------------------------+
 */
export function TagVoteChipGroup({
  tags,
  translations,
  emptyText,
  className,
  votePending,
  onVote,
  onWithdraw,
  onEditTags,
}: TagVoteChipGroupProps) {
  const { t } = useTranslation(["common", "community"]);
  const [active, setActive] = useState<{
    tagUnitId: string;
    anchor: HTMLElement;
  } | null>(null);

  const activeTag = useMemo(
    () => tags.find((tag) => tag.tagUnitId === active?.tagUnitId) ?? null,
    [active, tags],
  );
  const labelOf = (tagUnitId: string) =>
    translations[tagUnitId]?.name || t("community:tag_unknown_label");
  const descriptionOf = (tagUnitId: string) =>
    translations[tagUnitId]?.description || "";

  if (tags.length === 0) {
    if (!emptyText) return null;
    return (
      <p
        className={cn("m-0 text-sm leading-ui text-text-secondary", className)}
      >
        {emptyText}
      </p>
    );
  }

  return (
    <div className={className}>
      <Popover
        modal={false}
        open={Boolean(active && activeTag)}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
      >
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag.tagUnitId}
              type="button"
              className="max-w-full min-w-0 appearance-none rounded-full border-0 bg-transparent p-0 font-sans text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={(event) =>
                setActive({
                  tagUnitId: tag.tagUnitId,
                  anchor: event.currentTarget,
                })
              }
            >
              <Badge
                variant="ghost"
                className={cn(
                  "max-w-full cursor-pointer select-none gap-1.5 rounded-full border-0 px-2.5 py-1 transition-colors",
                  tag.viewerVote === 1 &&
                    "bg-sentiment-positive-fill/10 text-sentiment-positive-text hover:bg-sentiment-positive-fill/15",
                  tag.viewerVote === -1 &&
                    "bg-sentiment-negative-fill/10 text-sentiment-negative-text hover:bg-sentiment-negative-fill/15",
                  tag.viewerVote == null &&
                    "bg-surface-subtle text-text-primary hover:bg-surface-elevated",
                )}
              >
                <span className="min-w-0 truncate">
                  {labelOf(tag.tagUnitId)}
                </span>
                <span className="shrink-0 tabular-nums text-xs opacity-80">
                  {tag.score}
                </span>
              </Badge>
            </button>
          ))}
        </div>

        {active && activeTag ? (
          <PopoverContent
            anchor={active.anchor}
            side="bottom"
            align="start"
            sideOffset={8}
            className="z-10 w-[min(88vw,22rem)] p-4"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-medium leading-ui text-text-primary">
                  {labelOf(activeTag.tagUnitId)}
                </p>
                {descriptionOf(activeTag.tagUnitId) ? (
                  <p className="m-0 mt-1 line-clamp-3 text-sm leading-ui text-text-secondary">
                    {descriptionOf(activeTag.tagUnitId)}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="shrink-0"
                aria-label={t("common:close")}
                onClick={() => setActive(null)}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs leading-dense text-text-secondary">
              <span>
                {t("community:tag_score")} {activeTag.score}
              </span>
              <span>
                {t("community:tag_votes")} {activeTag.voteCount}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(
                  "min-w-0",
                  activeTag.viewerVote === 1 &&
                    "text-sentiment-positive-text hover:bg-black/10 dark:hover:bg-white/10",
                )}
                disabled={votePending}
                onClick={() => onVote(activeTag.tagUnitId, 1)}
              >
                <ArrowBigUp
                  className="size-4 shrink-0"
                  fill={activeTag.viewerVote === 1 ? "currentColor" : "none"}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="truncate">{t("community:tag_upvote")}</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(
                  "min-w-0",
                  activeTag.viewerVote === -1 &&
                    "text-sentiment-negative-text hover:bg-black/10 dark:hover:bg-white/10",
                )}
                disabled={votePending}
                onClick={() => onVote(activeTag.tagUnitId, -1)}
              >
                <ArrowBigDown
                  className="size-4 shrink-0"
                  fill={activeTag.viewerVote === -1 ? "currentColor" : "none"}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="truncate">{t("community:tag_downvote")}</span>
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-w-0"
                        disabled={votePending || activeTag.viewerVote == null}
                        onClick={() => onWithdraw(activeTag.tagUnitId)}
                      />
                    }
                  >
                    <RotateCcw className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">
                      {t("community:tag_vote_withdraw")}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {t("community:tag_vote_withdraw_tooltip")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="mt-3 flex min-w-0 flex-col gap-2">
              <TextLink
                to={unitHref({
                  type: "TAG",
                  unitId: activeTag.tagUnitId,
                  slug: translations[activeTag.tagUnitId]?.slug || null,
                })}
                className="inline-flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-sm leading-ui text-link hover:underline"
              >
                <Info className="size-4 shrink-0" aria-hidden />
                <span className="truncate">
                  {t("community:tag_view_definition")}
                </span>
              </TextLink>
              {onEditTags ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="justify-start"
                  onClick={onEditTags}
                >
                  <Pencil className="size-4" aria-hidden />
                  {t("common:edit")}
                </Button>
              ) : null}
            </div>
          </PopoverContent>
        ) : null}
      </Popover>
    </div>
  );
}
