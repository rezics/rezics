import {
  Badge,
  Button,
  Popover,
  PopoverContent,
} from "@rezics/ui/shadcn";
import { useCanEdit } from "@rezics/api/hooks";
import { useCastTagVoteMutation } from "@rezics/api/tag/tag.mutations";
import type {
  BatchTagTranslationResult,
  BookDTO,
  UnitTagDTO,
} from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { InjectedTag } from "@/search/models/injectedTags";
import { useNavigateToTagSearch } from "@/search/hooks/useNavigateToTagSearch";
import { cn } from "@/shared/utils/css-util";
import { useTagInteractionReducer } from "../hooks/useTagInteractionReducer";
import {
  X as CloseIcon,
  Pencil as EditOutlinedIcon,
  Search as SearchIcon,
  ThumbsDown as ThumbDownOutlinedIcon,
  ThumbsUp as ThumbUpOutlinedIcon,
} from "lucide-react";

export type TagInteractionProps = {
  tags: UnitTagDTO[];
  translations: BatchTagTranslationResult;
  bookUnitId: string;
  /** The parent book; drives the edit-permission check. */
  bookUnit?: BookDTO;
  /** Override the search navigation target. Defaults to global `/search`. */
  onSearchTags?: (tags: InjectedTag[]) => void;
  className?: string;
};

/**
 * TagInteraction — interactive tag chip group with three states.
 *
 *   idle: plain chips
 *   single-preview: clicked chip opens an anchored Popover with detail/vote/search
 *   multi-select: 2+ chips selected; an action bar offers "Search selected tags"
 *
 * Chips render translated labels from the batch translation map. Navigation
 * to search uses the shared `useNavigateToTagSearch` helper so the target
 * page receives pre-resolved tag data via router state.
 *
 * The popover is rendered with `modal={false}` so the backdrop is absent,
 * scroll lock is disabled, and other chips remain clickable while the
 * preview is open (per tag-interaction-component spec).
 */
export const TagInteraction: React.FC<TagInteractionProps> = ({
  tags,
  translations,
  bookUnitId,
  bookUnit,
  onSearchTags,
  className,
}) => {
  const { t } = useTranslation();
  const [state, dispatch] = useTagInteractionReducer();
  const defaultNavigate = useNavigateToTagSearch();
  const navigateToTagSearch = onSearchTags ?? defaultNavigate;
  const voteMutation = useCastTagVoteMutation();
  const navigate = useNavigate();
  const canEditTags = useCanEdit({ resource: "tag", ownerUnit: bookUnit });

  const labelOf = useCallback(
    (tagUnitId: string) => translations[tagUnitId]?.name || tagUnitId,
    [translations],
  );
  const slugOf = useCallback(
    (tagUnitId: string): string | undefined =>
      translations[tagUnitId]?.slug || undefined,
    [translations],
  );

  const previewTag = useMemo(() => {
    if (state.kind !== "single-preview") return null;
    return tags.find((tag) => tag.tagUnitId === state.tagUnitId) ?? null;
  }, [state, tags]);

  const handleChipClick = (
    event: React.MouseEvent<HTMLDivElement>,
    tagUnitId: string,
  ) => {
    const anchor = event.currentTarget;
    dispatch({ type: "CLICK_CHIP", tagUnitId, anchor });
  };

  const isSelected = (tagUnitId: string): boolean => {
    if (state.kind === "single-preview") return state.tagUnitId === tagUnitId;
    if (state.kind === "multi-select")
      return state.selected.includes(tagUnitId);
    return false;
  };

  const handleSearchSingle = (tagUnitId: string) => {
    navigateToTagSearch([
      { slug: slugOf(tagUnitId), unitId: tagUnitId, name: labelOf(tagUnitId) },
    ]);
  };

  const handleSearchMulti = () => {
    if (state.kind !== "multi-select") return;
    const items = state.selected.map((id) => ({
      slug: slugOf(id),
      unitId: id,
      name: labelOf(id),
    }));
    if (items.length === 0) return;
    navigateToTagSearch(items);
  };

  const handleVote = (tagUnitId: string, value: 1 | -1) => {
    voteMutation.mutate({ tagUnitId, unitId: bookUnitId, value });
  };

  const popoverOpen = state.kind === "single-preview" && previewTag !== null;

  return (
    <div className={className}>
      <Popover
        modal={false}
        open={popoverOpen}
        onOpenChange={(open) => {
          if (!open) dispatch({ type: "CLOSE_POPPER" });
        }}
      >
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const selected = isSelected(tag.tagUnitId);
            const chipNode = (
              <Badge
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                variant={selected ? "default" : "outline"}
                className={cn("cursor-pointer select-none")}
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
            if (
              state.kind === "single-preview" &&
              state.tagUnitId === tag.tagUnitId
            ) {
              return <div key={tag.tagUnitId}>{chipNode}</div>;
            }
            return <div key={tag.tagUnitId}>{chipNode}</div>;
          })}
        </div>

        {popoverOpen && previewTag && (
          <PopoverContent
            anchor={state.kind === "single-preview" ? state.anchor : undefined}
            side="bottom"
            align="start"
            sideOffset={8}
            className="p-4 min-w-[280px] max-w-[360px] z-10"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">
                {labelOf(previewTag.tagUnitId)}
              </p>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Close"
                onClick={() => dispatch({ type: "CLOSE_POPPER" })}
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
                {t("tag.score", "Score")}: {previewTag.score}
              </span>
              <span>
                {t("tag.votes", "Votes")}: {previewTag.voteCount}
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
                {t("tag.upvote", "Upvote")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleVote(previewTag.tagUnitId, -1)}
                disabled={voteMutation.isPending}
              >
                <ThumbDownOutlinedIcon className="h-4 w-4 mr-1" />
                {t("tag.downvote", "Downvote")}
              </Button>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <Button
                size="sm"
                className="w-full"
                onClick={() => handleSearchSingle(previewTag.tagUnitId)}
              >
                <SearchIcon className="h-4 w-4 mr-1" />
                {t("tag.search_this", "Search this tag")}
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
                  {t("common.edit")}
                </Button>
              )}
            </div>
          </PopoverContent>
        )}
      </Popover>

      {state.kind === "multi-select" && (
        <div className="mt-3 p-2 flex items-center justify-between gap-2 rounded-md border border-border-whisper bg-surface-elevated">
          <p className="text-sm px-1">
            {t("tag.selected_count", "Selected: {{count}}", {
              count: state.selected.length,
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => dispatch({ type: "DESELECT_ALL" })}
            >
              {t("tag.clear", "Clear")}
            </Button>
            <Button size="sm" onClick={handleSearchMulti}>
              <SearchIcon className="h-4 w-4 mr-1" />
              {t("tag.search_selected", "Search selected tags")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagInteraction;
