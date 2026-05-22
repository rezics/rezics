import { postSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import type { PostSearchDocument, PostSearchOptions } from "@rezics/contract";
import { EmptyState } from "@rezics/ui";
import { Link } from "@/shared/ui/link";
import { Avatar, AvatarFallback, AvatarImage, Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type { FC } from "react";
import { useState } from "react";
import { FilterBar, type FilterBarConfig } from "@/user/components/FilterBar";
import {
  type ChipDefinition,
  InnerFilterPanel,
} from "@/user/components/InnerFilterPanel";
import { useProfileContext } from "@/user/components/ProfileLayout";
import * as m from "@rezics/i18n/messages";

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
  const { userId } = useProfileContext();
  const [kind, setKind] = useState("REVIEW");
  const [filters, setFilters] = useState<Record<string, string>>({
    sort: "createdAt:desc",
  });
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const [sortField, sortOrder] = (filters.sort ?? "createdAt:desc").split(":");

  const searchOpts: PostSearchOptions = {
    authorUserId: userId,
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
        <p className="text-sm text-text-secondary py-12 text-center">
          {m.common_loading()}
        </p>
      ) : posts.length === 0 ? (
        <EmptyState
          title={filters.q ? m.search_empty_title() : m.common_no_data()}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-text-secondary">
                Page {currentPage + 1} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOffset(offset + limit)}
                disabled={currentPage + 1 >= totalPages}
              >
                Next
              </Button>
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

  const targetUnitId = post.targetUnitId;

  return (
    <div className="border border-border-whisper rounded-lg p-4 hover:border-border-defined transition-colors">
      <div className="flex items-start gap-3">
        <Avatar className="w-8 h-8">
          <AvatarImage
            src={post.authorAvatar ?? undefined}
            alt={post.authorName ?? ""}
          />
          <AvatarFallback>
            {post.authorName?.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {scoreDisplay && (
              <span className="text-sm text-amber-500">{scoreDisplay}</span>
            )}
            {targetTitle &&
              (targetUnitId ? (
                <Link
                  to="/unit/$unitId"
                  params={{ unitId: targetUnitId }}
                  search={{ view: "auto" }}
                  className="text-sm text-text-secondary no-underline hover:text-text-primary"
                >
                  on {targetTitle}
                </Link>
              ) : (
                <span className="text-sm text-text-secondary">
                  on {targetTitle}
                </span>
              ))}
            <span className="text-xs text-text-secondary">{date}</span>
          </div>
          {post.body && (
            <p className="text-sm mt-1 line-clamp-3">{post.body}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
            {post.replyCount > 0 && <span>{post.replyCount} replies</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
