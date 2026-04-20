import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SearchIcon from "@mui/icons-material/Search";
import ThumbDownOutlinedIcon from "@mui/icons-material/ThumbDownOutlined";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import {
  Box,
  Button,
  Chip,
  ClickAwayListener,
  IconButton,
  Paper,
  Popper,
  Typography,
} from "@mui/material";
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
import { useTagInteractionReducer } from "../hooks/useTagInteractionReducer";

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
 *   single-preview: clicked chip opens an anchored Popper with detail/vote/search
 *   multi-select: 2+ chips selected; an action bar offers "Search selected tags"
 *
 * Chips render translated labels from the batch translation map. Navigation
 * to search uses the shared `useNavigateToTagSearch` helper so the target
 * page receives pre-resolved tag data via router state.
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

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const selected = isSelected(tag.tagUnitId);
          return (
            <Chip
              key={tag.tagUnitId}
              label={`${labelOf(tag.tagUnitId)} (${tag.score})`}
              size="small"
              clickable
              color={selected ? "primary" : "default"}
              variant={selected ? "filled" : "outlined"}
              onClick={(e) =>
                handleChipClick(
                  e as unknown as React.MouseEvent<HTMLDivElement>,
                  tag.tagUnitId,
                )
              }
            />
          );
        })}
      </div>

      {state.kind === "single-preview" && previewTag && (
        <Popper
          open
          anchorEl={state.anchor}
          placement="bottom"
          modifiers={[
            { name: "offset", options: { offset: [0, 8] } },
            { name: "preventOverflow", options: { padding: 8 } },
          ]}
          className="z-10"
        >
          <ClickAwayListener
            onClickAway={(event) => {
              const target = event.target as Node;
              if (state.anchor.contains(target)) return;
              dispatch({ type: "CLOSE_POPPER" });
            }}
          >
            <Paper elevation={4} className="p-4 min-w-[280px] max-w-[360px]">
              <div className="flex items-start justify-between gap-2">
                <Typography variant="subtitle1" className="font-semibold">
                  {labelOf(previewTag.tagUnitId)}
                </Typography>
                <IconButton
                  size="small"
                  aria-label="Close"
                  onClick={() => dispatch({ type: "CLOSE_POPPER" })}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </div>

              {translations[previewTag.tagUnitId]?.description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  className="mt-1"
                >
                  {translations[previewTag.tagUnitId]?.description}
                </Typography>
              )}

              <Box className="mt-3 flex items-center gap-3 text-sm opacity-70">
                <span>
                  {t("tag.score", "Score")}: {previewTag.score}
                </span>
                <span>
                  {t("tag.votes", "Votes")}: {previewTag.voteCount}
                </span>
              </Box>

              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="small"
                  startIcon={<ThumbUpOutlinedIcon fontSize="small" />}
                  variant="outlined"
                  onClick={() => handleVote(previewTag.tagUnitId, 1)}
                  disabled={voteMutation.isPending}
                >
                  {t("tag.upvote", "Upvote")}
                </Button>
                <Button
                  size="small"
                  startIcon={<ThumbDownOutlinedIcon fontSize="small" />}
                  variant="outlined"
                  onClick={() => handleVote(previewTag.tagUnitId, -1)}
                  disabled={voteMutation.isPending}
                >
                  {t("tag.downvote", "Downvote")}
                </Button>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <Button
                  size="small"
                  fullWidth
                  variant="contained"
                  startIcon={<SearchIcon fontSize="small" />}
                  onClick={() => handleSearchSingle(previewTag.tagUnitId)}
                >
                  {t("tag.search_this", "Search this tag")}
                </Button>
                {canEditTags && (
                  <Button
                    size="small"
                    fullWidth
                    variant="outlined"
                    startIcon={<EditOutlinedIcon fontSize="small" />}
                    onClick={() =>
                      navigate({ to: `/book/${bookUnitId}/edit/tag` })
                    }
                  >
                    {t("common.edit")}
                  </Button>
                )}
              </div>
            </Paper>
          </ClickAwayListener>
        </Popper>
      )}

      {state.kind === "multi-select" && (
        <Paper
          elevation={1}
          className="mt-3 p-2 flex items-center justify-between gap-2"
        >
          <Typography variant="body2" className="px-1">
            {t("tag.selected_count", "Selected: {{count}}", {
              count: state.selected.length,
            })}
          </Typography>
          <div className="flex items-center gap-2">
            <Button
              size="small"
              onClick={() => dispatch({ type: "DESELECT_ALL" })}
            >
              {t("tag.clear", "Clear")}
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<SearchIcon fontSize="small" />}
              onClick={handleSearchMulti}
            >
              {t("tag.search_selected", "Search selected tags")}
            </Button>
          </div>
        </Paper>
      )}
    </div>
  );
};

export default TagInteraction;
