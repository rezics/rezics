import { Avatar, Box, Typography } from "@mui/material";
import {
  postSearchQueryOptions,
  usePostSearchQuery,
} from "@rezics/api/meili/meili.queries";
import type { PostSearchDocument, PostSearchOptions } from "@rezics/contract";
import { EmptyState } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import type { FC } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FilterBar, type FilterBarConfig } from "@/user/components/FilterBar";
import {
  type ChipDefinition,
  InnerFilterPanel,
} from "@/user/components/InnerFilterPanel";
import { useProfileContext } from "@/user/components/ProfileLayout";

const KIND_CHIPS: ChipDefinition[] = [
  { value: "REVIEW", label: "Reviews" },
  { value: "REMARK", label: "Remarks" },
  { value: "EXCERPT", label: "Excerpts" },
  { value: "POST", label: "Posts" },
];

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest" },
  { value: "createdAt:asc", label: "Oldest" },
  { value: "replyCount:desc", label: "Most Replies" },
];

export const ContentTabSection: FC = () => {
  const { t } = useTranslation();
  const { unitId } = useProfileContext();
  const [kind, setKind] = useState("REVIEW");
  const [filters, setFilters] = useState<Record<string, string>>({
    sort: "createdAt:desc",
  });
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const [sortField, sortOrder] = (filters.sort ?? "createdAt:desc").split(":");

  const searchOpts: PostSearchOptions = {
    authorUserId: unitId,
    kind,
    keyword: filters.q || undefined,
    sort: {
      field: sortField as any,
      order: sortOrder as any,
    },
    offset,
    limit,
  };

  const { data, isLoading } = useQuery(postSearchQueryOptions(searchOpts));

  const filterConfig: FilterBarConfig = {
    showSearch: true,
    searchPlaceholder: "Search content...",
    dropdowns: [
      {
        key: "sort",
        label: "Sort",
        options: SORT_OPTIONS,
      },
    ],
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setOffset(0);
  };

  const handleKindChange = (value: string) => {
    setKind(value);
    setOffset(0);
  };

  const posts = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit);

  return (
    <div className="flex flex-col gap-4 py-4">
      <InnerFilterPanel
        chips={KIND_CHIPS}
        activeValue={kind}
        onChipChange={handleKindChange}
      >
        <FilterBar
          config={filterConfig}
          values={filters}
          onChange={handleFilterChange}
        />
      </InnerFilterPanel>

      {isLoading ? (
        <Typography
          variant="body2"
          color="text.secondary"
          className="py-8 text-center"
        >
          {t("common.loading")}
        </Typography>
      ) : posts.length === 0 ? (
        <EmptyState
          title={
            filters.q ? t("search.empty.title") : t("common.no_data")
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {posts.map((post: PostSearchDocument) => (
              <PostListItem key={post.id} post={post} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <Typography variant="body2" color="text.secondary">
                Page {currentPage + 1} of {totalPages}
              </Typography>
              <button
                type="button"
                onClick={() => setOffset(offset + limit)}
                disabled={currentPage + 1 >= totalPages}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const PostListItem: FC<{ post: PostSearchDocument }> = ({ post }) => {
  const targetTitle = post.targetTitles?.[0];
  const date = new Date(post.createdAt).toLocaleDateString();
  const scoreDisplay =
    post.scoreValue != null
      ? `${"★".repeat(Math.round(post.scoreValue / 2))}${"☆".repeat(5 - Math.round(post.scoreValue / 2))}`
      : null;

  return (
    <Box className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start gap-3">
        <Avatar
          src={post.authorAvatar ?? undefined}
          sx={{ width: 32, height: 32 }}
        >
          {post.authorName?.charAt(0).toUpperCase()}
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {scoreDisplay && (
              <Typography variant="body2" className="text-amber-500">
                {scoreDisplay}
              </Typography>
            )}
            {targetTitle && (
              <Typography variant="body2" color="text.secondary">
                on {targetTitle}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {date}
            </Typography>
          </div>
          {post.body && (
            <Typography variant="body2" className="mt-1 line-clamp-3">
              {post.body}
            </Typography>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            {post.replyCount > 0 && <span>{post.replyCount} replies</span>}
          </div>
        </div>
      </div>
    </Box>
  );
};
