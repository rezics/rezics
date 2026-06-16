import { useCanEdit, useCurrentUserId } from "@rezics/api/hooks";
import { useCastTagVoteMutation } from "@rezics/api/tag/tag.mutations";
import type {
  BatchTagTranslationResult,
  BookDTO,
  UnitTagDTO,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Badge, Button, Popover, PopoverContent } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import {
  X as CloseIcon,
  Pencil as EditOutlinedIcon,
  Search as SearchIcon,
  ThumbsDown as ThumbDownOutlinedIcon,
  ThumbsUp as ThumbUpOutlinedIcon,
} from "lucide-react";
import type React from "react";
import { useMemo, useRef } from "react";
import type { InjectedTag } from "@/search";
import { useNavigateToTagSearch } from "@/search";
import { cn } from "@/shared/utils/css-util";
import { useTagInteractionReducer } from "../hooks/useTagInteractionReducer";

export type TagInteractionProps = {
  tags: UnitTagDTO[];
  translations: BatchTagTranslationResult;
  bookUnitId: string;
  /**
   * The parent book; drives the edit-permission check.
   * 父书；驱动编辑权限检查。
   */
  bookUnit?: BookDTO;
  /**
   * Override the search navigation target. Defaults to global `/search`.
   * 覆盖搜索导航目标。默认为全局 `/search`。
   */
  onSearchTags?: (tags: InjectedTag[]) => void;
  className?: string;
};

const TAG_CHIP_SELECTOR = '[data-tag-chip="true"]';

/**
 * TagInteraction — interactive tag chip group with preview and selection states.
 * TagInteraction — 带预览与选择状态的交互式标签 chip 组。
 *
 *   preview: clicked chip opens an anchored Popover with detail/vote/search
 *   selection: clicked chips are selected; an action bar offers "Search selected tags"
 *   preview：点击 chip 打开锚定的 Popover，含详情/投票/搜索
 *   selection：被点击的 chip 进入选中态；操作栏提供 "Search selected tags"
 *
 * Chips render translated labels from the batch translation map. Navigation
 * to search uses the shared `useNavigateToTagSearch` helper so the target
 * page receives pre-resolved tag data via router state.
 * chip 从批量翻译映射渲染翻译后的标签。搜索导航使用共享的
 * `useNavigateToTagSearch` 辅助函数，使目标页通过路由 state 收到预解析的标签数据。
 *
 * The popover is rendered with `modal={false}` so the backdrop is absent,
 * scroll lock is disabled, and other chips remain clickable while the
 * preview is open.
 * popover 以 `modal={false}` 渲染，因此没有背景遮罩、滚动锁定被禁用，
 * 且预览打开时其他 chip 仍可点击。
 */
export const TagInteraction: React.FC<TagInteractionProps> = ({
  tags,
  translations,
  bookUnitId,
  bookUnit,
  onSearchTags,
  className,
}) => {
  const { t } = useTranslation(["common", "community"]);
  const userId = useCurrentUserId();
  const [state, dispatch] = useTagInteractionReducer();
  const defaultNavigate = useNavigateToTagSearch();
  const navigateToTagSearch = onSearchTags ?? defaultNavigate;
  const voteMutation = useCastTagVoteMutation();
  const navigate = useNavigate();
  const canEditTags = useCanEdit({ resource: "tag", ownerUnit: bookUnit });
  const suppressNextClickRef = useRef<string | null>(null);

  const labelOf = (tagUnitId: string) =>
    translations[tagUnitId]?.name || tagUnitId;
  const slugOf = (tagUnitId: string): string | undefined =>
    translations[tagUnitId]?.slug || undefined;

  const previewTag = useMemo(() => {
    if (!state.preview) return null;
    return (
      tags.find((tag) => tag.tagUnitId === state.preview?.tagUnitId) ?? null
    );
  }, [state.preview, tags]);

  const handleChipClick = (
    event: React.MouseEvent<HTMLDivElement>,
    tagUnitId: string,
  ) => {
    if (suppressNextClickRef.current === tagUnitId) {
      suppressNextClickRef.current = null;
      return;
    }

    const anchor = event.currentTarget;
    dispatch({ type: "CLICK_CHIP", tagUnitId, anchor });
  };

  const handleChipPointerDownCapture = (
    event: React.PointerEvent<HTMLDivElement>,
    tagUnitId: string,
  ) => {
    if (!state.preview || state.selected.length > 0) return;

    event.preventDefault();
    event.stopPropagation();
    suppressNextClickRef.current = tagUnitId;

    if (state.preview.tagUnitId === tagUnitId) {
      dispatch({ type: "CLICK_CHIP", tagUnitId, anchor: event.currentTarget });
      return;
    }

    dispatch({
      type: "SELECT_CHIPS",
      tagUnitIds: [state.preview.tagUnitId, tagUnitId],
    });
  };

  const isSelected = (tagUnitId: string): boolean => {
    return (
      state.preview?.tagUnitId === tagUnitId ||
      state.selected.includes(tagUnitId)
    );
  };

  const handleSearchSingle = (tagUnitId: string) => {
    navigateToTagSearch([
      { slug: slugOf(tagUnitId), unitId: tagUnitId, name: labelOf(tagUnitId) },
    ]);
  };

  const handleSearchMulti = () => {
    const items = state.selected.map((id) => ({
      slug: slugOf(id),
      unitId: id,
      name: labelOf(id),
    }));
    if (items.length === 0) return;
    navigateToTagSearch(items);
  };

  const handleVote = (tagUnitId: string, value: 1 | -1) => {
    // Require auth before casting a vote.
    // 投票前需要认证。
    if (!userId) return;
    voteMutation.mutate({ tagUnitId, unitId: bookUnitId, value });
  };

  const popoverOpen = state.preview !== null && previewTag !== null;

  return (
    <div className={className}>
      <Popover
        modal={false}
        open={popoverOpen}
        onOpenChange={(open, details) => {
          if (open) return;
          // Preserve click ordering when moving from preview into selection.
          // Otherwise Base UI may close the preview before the chip click can
          // fold the previewed tag into the selected array.
          // 从预览进入选择时保留点击顺序。否则 Base UI 可能在 chip 点击
          // 把预览标签折叠进选中数组之前就关闭了预览。
          if (
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
            const chipNode = (
              <Badge
                role="button"
                tabIndex={0}
                data-tag-chip="true"
                aria-pressed={selected}
                variant={selected ? "default" : "outline"}
                className={cn("cursor-pointer select-none")}
                onPointerDownCapture={(e) =>
                  handleChipPointerDownCapture(
                    e as unknown as React.PointerEvent<HTMLDivElement>,
                    tag.tagUnitId,
                  )
                }
                onClick={(e) =>
                  handleChipClick(
                    e as unknown as React.MouseEvent<HTMLDivElement>,
                    tag.tagUnitId,
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleChipClick(
                      e as unknown as React.MouseEvent<HTMLDivElement>,
                      tag.tagUnitId,
                    );
                  }
                }}
              >
                {labelOf(tag.tagUnitId)} ({tag.score})
              </Badge>
            );
            if (state.preview?.tagUnitId === tag.tagUnitId) {
              return <div key={tag.tagUnitId}>{chipNode}</div>;
            }
            return <div key={tag.tagUnitId}>{chipNode}</div>;
          })}
        </div>

        {popoverOpen && previewTag && (
          <PopoverContent
            anchor={state.preview?.anchor}
            side="bottom"
            align="start"
            sideOffset={8}
            className="p-4 min-w-[280px] max-w-[360px] z-10"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">
                {labelOf(previewTag.tagUnitId)}
              </p>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("common:close")}
                onClick={() => dispatch({ type: "CLOSE_PREVIEW" })}
              >
                <CloseIcon className="h-4 w-4" />
              </Button>
            </div>

            {translations[previewTag.tagUnitId]?.description && (
              <p className="text-sm text-text-secondary mt-1">
                {translations[previewTag.tagUnitId]?.description}
              </p>
            )}

            <div className="mt-3 flex items-center gap-3 text-sm opacity-70">
              <span>
                {t("community:tag_score")}: {previewTag.score}
              </span>
              <span>
                {t("community:tag_votes")}: {previewTag.voteCount}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleVote(previewTag.tagUnitId, 1)}
                disabled={voteMutation.isPending}
              >
                <ThumbUpOutlinedIcon className="h-4 w-4 mr-1" />
                {t("community:tag_upvote")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleVote(previewTag.tagUnitId, -1)}
                disabled={voteMutation.isPending}
              >
                <ThumbDownOutlinedIcon className="h-4 w-4 mr-1" />
                {t("community:tag_downvote")}
              </Button>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <Button
                size="sm"
                className="w-full"
                onClick={() => handleSearchSingle(previewTag.tagUnitId)}
              >
                <SearchIcon className="h-4 w-4 mr-1" />
                {t("community:tag_search_this")}
              </Button>
              {canEditTags && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    navigate({ to: `/book/${bookUnitId}/edit/tag` })
                  }
                >
                  <EditOutlinedIcon className="h-4 w-4 mr-1" />
                  {t("common:edit")}
                </Button>
              )}
            </div>
          </PopoverContent>
        )}
      </Popover>

      {state.selected.length > 0 && (
        <div className="mt-3 p-2 flex items-center justify-between gap-2 rounded-md border border-border-whisper bg-surface-elevated">
          <p className="text-sm px-1">
            {t("community:tag_selected_count", {
              count: state.selected.length,
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => dispatch({ type: "DESELECT_ALL" })}
            >
              {t("community:tag_clear")}
            </Button>
            <Button size="sm" onClick={handleSearchMulti}>
              <SearchIcon className="h-4 w-4 mr-1" />
              {t("community:tag_search_selected")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

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
