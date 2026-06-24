import type { BatchTagTranslationResult, UnitTagDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Badge, Button, Popover, PopoverContent } from "@rezics/ui/shadcn";
import {
  ArrowBigDown,
  ArrowBigUp,
  Info,
  Pencil,
  Search,
  X,
} from "lucide-react";
import type React from "react";
import { useMemo, useRef } from "react";
import type { InjectedTag } from "@/search";
import { TextLink, unitHref } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import { useTagInteractionReducer } from "../hooks/useTagInteractionReducer";
import {
  resolveTagVoteClickAction,
  tagSearchTarget,
} from "../models/tagVoteInteraction";

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
  onSearchTags?: (tags: InjectedTag[]) => void;
};

const TAG_CHIP_SELECTOR = '[data-tag-chip="true"]';

const ACTION_GRID_STYLE = {
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 5.75rem), 1fr))",
} satisfies React.CSSProperties;

const EXPLORE_GRID_STYLE = {
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 9rem), 1fr))",
} satisfies React.CSSProperties;

/**
 * 可复用 tag 投票 chip 组。chip 使用父容器宽度自然换行；有搜索回调时支持
 * preview、multi-select 与单/多 tag 搜索，没有搜索回调时只提供投票管理。
 *
 * Mobile
 * +------------------------------+
 * | [tag score] [long tag wraps] |
 * | popover: title + stats       |
 * | [up] [down] [edit] by width  |
 * | [search] [info] by width     |
 * +------------------------------+
 *
 * Tablet
 * +------------------------------------------+
 * | parent width drives action wrapping      |
 * | selected bar appears below chip cloud    |
 * +------------------------------------------+
 *
 * Desktop
 * +------------------------------------------------+
 * | dense chip cloud; vote color visible in-place  |
 * | action groups stay visually separate           |
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
  onSearchTags,
}: TagVoteChipGroupProps) {
  const { t } = useTranslation(["common", "community"]);
  const [state, dispatch] = useTagInteractionReducer();
  const suppressNextClickRef = useRef<string | null>(null);
  const searchEnabled = Boolean(onSearchTags);

  const activeTag = useMemo(
    () =>
      tags.find((tag) => tag.tagUnitId === state.preview?.tagUnitId) ?? null,
    [state.preview, tags],
  );
  const labelOf = (tagUnitId: string) =>
    translations[tagUnitId]?.name || t("community:tag_unknown_label");
  const descriptionOf = (tagUnitId: string) =>
    translations[tagUnitId]?.description || "";
  const isSelected = (tagUnitId: string) =>
    state.preview?.tagUnitId === tagUnitId ||
    state.selected.includes(tagUnitId);
  const searchTargets = (tagUnitIds: string[]) =>
    tagUnitIds.map((tagUnitId) =>
      tagSearchTarget(tagUnitId, translations, labelOf(tagUnitId)),
    );
  const handleSearchSingle = (tagUnitId: string) => {
    onSearchTags?.(searchTargets([tagUnitId]));
  };
  const handleSearchSelected = () => {
    if (state.selected.length === 0) return;
    onSearchTags?.(searchTargets(state.selected));
  };
  const handleVoteClick = (tag: TagVoteChipRow, value: 1 | -1) => {
    const action = resolveTagVoteClickAction(tag.viewerVote, value);
    if (action.kind === "withdraw") {
      onWithdraw(tag.tagUnitId);
      return;
    }
    onVote(tag.tagUnitId, action.value);
  };
  const handleChipClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    tagUnitId: string,
  ) => {
    if (suppressNextClickRef.current === tagUnitId) {
      suppressNextClickRef.current = null;
      return;
    }

    dispatch({
      type: "CLICK_CHIP",
      tagUnitId,
      anchor: event.currentTarget,
    });
  };
  const handleChipPointerDownCapture = (
    event: React.PointerEvent<HTMLButtonElement>,
    tagUnitId: string,
  ) => {
    if (!searchEnabled || !state.preview || state.selected.length > 0) return;

    event.preventDefault();
    event.stopPropagation();
    suppressNextClickRef.current = tagUnitId;

    if (state.preview.tagUnitId === tagUnitId) {
      dispatch({
        type: "CLICK_CHIP",
        tagUnitId,
        anchor: event.currentTarget,
      });
      return;
    }

    dispatch({
      type: "SELECT_CHIPS",
      tagUnitIds: [state.preview.tagUnitId, tagUnitId],
    });
  };

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
        open={Boolean(state.preview && activeTag)}
        onOpenChange={(open, details) => {
          if (open) return;
          if (
            searchEnabled &&
            details?.reason === "outside-press" &&
            isTagChipEventTarget(details.event)
          ) {
            details.cancel();
            return;
          }
          dispatch({ type: "CLOSE_PREVIEW" });
        }}
      >
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const selected = isSelected(tag.tagUnitId);
            return (
              <button
                key={tag.tagUnitId}
                type="button"
                data-tag-chip="true"
                aria-pressed={selected}
                className="max-w-full min-w-0 appearance-none rounded-full border-0 bg-transparent p-0 font-sans text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onPointerDownCapture={(event) =>
                  handleChipPointerDownCapture(event, tag.tagUnitId)
                }
                onClick={(event) => handleChipClick(event, tag.tagUnitId)}
              >
                <Badge
                  variant="ghost"
                  className={cn(
                    "max-w-full cursor-pointer select-none gap-1.5 rounded-full border-0 px-2.5 py-1 transition-colors",
                    selected && "ring-1 ring-border-focus",
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
            );
          })}
        </div>

        {state.preview && activeTag ? (
          <PopoverContent
            anchor={state.preview.anchor}
            side="bottom"
            align="start"
            sideOffset={8}
            className="z-10 w-[min(88vw,22rem)] p-3"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-medium leading-ui text-text-primary">
                  {labelOf(activeTag.tagUnitId)}
                </p>
                {descriptionOf(activeTag.tagUnitId) ? (
                  <p className="m-0 mt-1 line-clamp-2 text-sm leading-ui text-text-secondary">
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
                onClick={() => dispatch({ type: "CLOSE_PREVIEW" })}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 text-xs leading-dense text-text-secondary">
              <span>
                {t("community:tag_score")} {activeTag.score}
              </span>
              <span>
                {t("community:tag_votes")} {activeTag.voteCount}
              </span>
            </div>

            <div className="mt-3 grid gap-2" style={ACTION_GRID_STYLE}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(
                  "min-w-0 cursor-pointer",
                  activeTag.viewerVote === 1 &&
                    "border-sentiment-positive-fill/30 bg-sentiment-positive-fill/10 text-sentiment-positive-text hover:bg-sentiment-positive-fill/10 hover:text-sentiment-positive-text active:bg-sentiment-positive-fill/10",
                  activeTag.viewerVote !== 1 &&
                    "hover:bg-sentiment-positive-fill/10 hover:text-sentiment-positive-text",
                )}
                disabled={votePending}
                onClick={() => handleVoteClick(activeTag, 1)}
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
                  "min-w-0 cursor-pointer",
                  activeTag.viewerVote === -1 &&
                    "border-sentiment-negative-fill/30 bg-sentiment-negative-fill/10 text-sentiment-negative-text hover:bg-sentiment-negative-fill/10 hover:text-sentiment-negative-text active:bg-sentiment-negative-fill/10",
                  activeTag.viewerVote !== -1 &&
                    "hover:bg-sentiment-negative-fill/10 hover:text-sentiment-negative-text",
                )}
                disabled={votePending}
                onClick={() => handleVoteClick(activeTag, -1)}
              >
                <ArrowBigDown
                  className="size-4 shrink-0"
                  fill={activeTag.viewerVote === -1 ? "currentColor" : "none"}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="truncate">{t("community:tag_downvote")}</span>
              </Button>
              {onEditTags ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-w-0"
                  onClick={onEditTags}
                >
                  <Pencil className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{t("common:edit")}</span>
                </Button>
              ) : null}
            </div>

            <div className="mt-2 grid gap-2" style={EXPLORE_GRID_STYLE}>
              {onSearchTags ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-w-0 justify-start text-link hover:bg-surface-subtle hover:text-link-hover"
                  onClick={() => handleSearchSingle(activeTag.tagUnitId)}
                >
                  <Search className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">
                    {t("community:tag_search_this")}
                  </span>
                </Button>
              ) : null}
              <TextLink
                to={unitHref({
                  type: "TAG",
                  unitId: activeTag.tagUnitId,
                  slug: translations[activeTag.tagUnitId]?.slug || null,
                })}
                underline="none"
                className="inline-flex h-8 min-w-0 items-center justify-start gap-1 rounded-4xl px-3 text-sm font-medium leading-ui text-link transition-colors hover:bg-surface-subtle hover:text-link-hover"
              >
                <Info className="size-4 shrink-0" aria-hidden />
                <span className="truncate">
                  {t("community:tag_view_definition")}
                </span>
              </TextLink>
            </div>
          </PopoverContent>
        ) : null}
      </Popover>

      {onSearchTags && state.selected.length > 0 ? (
        <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-border-whisper bg-surface-elevated p-2">
          <p className="m-0 min-w-0 px-1 text-sm leading-ui text-text-secondary">
            {t("community:tag_selected_count", {
              count: state.selected.length,
            })}
          </p>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => dispatch({ type: "DESELECT_ALL" })}
            >
              {t("community:tag_clear")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="min-w-0"
              onClick={handleSearchSelected}
            >
              <Search className="size-4 shrink-0" aria-hidden />
              <span className="truncate">
                {t("community:tag_search_selected")}
              </span>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isTagChipEventTarget(event: Event | undefined): boolean {
  const target = event?.target;

  if (target instanceof Element && target.closest(TAG_CHIP_SELECTOR)) {
    return true;
  }

  if (
    target instanceof Node &&
    target.parentElement?.closest(TAG_CHIP_SELECTOR)
  ) {
    return true;
  }

  return (
    event
      ?.composedPath()
      .some(
        (node) => node instanceof Element && node.matches(TAG_CHIP_SELECTOR),
      ) ?? false
  );
}
