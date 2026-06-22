import { getI18nRuntime } from "@rezics/i18n/runtime";
import { formatDate } from "@rezics/ui";

/**
 * ContentTabSection — 用户资料页内容标签页，支持评论/短评/摘录分类与搜索排序，
 * 动态加载分页列表，展示用户创建的所有内容条目。
 *
 * ┌───────────────────────────────────────────┐
 * │ Content Tab (desktop 1024px+)             │
 * │ ┌─────────────────────────────────────────┐
 * │ │ [Review] [Remark] [Excerpt] [Post]      │
 * │ ├─────────────────────────────────────────┤
 * │ │ [Search...]  [Sort: Newest ▼]           │
 * │ ├─────────────────────────────────────────┤
 * │ │ ★★★★★ on "Book Title" — May 15         │
 * │ │ Great read! Really enjoyed this...      │
 * │ │ 5 replies                               │
 * │ │                                         │
 * │ │ ★★★★☆ on "Another Book" — May 10      │
 * │ │ Worth reading for sure.                 │
 * │ │ [Prev] Page 1 of 3 [Next]               │
 * │ └─────────────────────────────────────────┘
 * └───────────────────────────────────────────┘
 *
 * ┌───────────────────────┐
 * │ Content (tablet 768)  │
 * │ ┌─────────────────────┐
 * │ │ [Review] [Remark]   │
 * │ ├─────────────────────┤
 * │ │ [Search...]         │
 * │ │ [Sort: Newest ▼]    │
 * │ ├─────────────────────┤
 * │ │ ★★★★★ Book Title    │
 * │ │ Great read!         │
 * │ │ [Prev] 1 of 2[Next] │
 * │ └─────────────────────┘
 * └───────────────────────┘
 *
 * ┌──────────────────┐
 * │ Content (mobile) │
 * │ ┌────────────────┐
 * │ │ Reviews...     │
 * │ ├────────────────┤
 * │ │ [Search..]     │
 * │ │ ★★★ Title..    │
 * │ │ Great read...  │
 * │ │ [Prev] 1 [Nxt] │
 * │ └────────────────┘
 * └──────────────────┘
 *
 * ┌──────────────────┐
 * │ Empty (no data)  │
 * │ ┌────────────────┐
 * │ │ No items found │
 * │ └────────────────┘
 * └──────────────────┘
 */

const i18nMessages = {
  search_category_reviews: () =>
    getI18nRuntime().i18n.t("search:category_reviews"),
  search_category_remarks: () =>
    getI18nRuntime().i18n.t("search:category_remarks"),
  search_category_excerpts: () =>
    getI18nRuntime().i18n.t("search:category_excerpts"),
  search_category_posts: () => getI18nRuntime().i18n.t("search:category_posts"),
  shelf_sort_newest: () => getI18nRuntime().i18n.t("entity:shelf_sort_newest"),
  shelf_sort_oldest: () => getI18nRuntime().i18n.t("entity:shelf_sort_oldest"),
  profile_sort_most_replies: () =>
    getI18nRuntime().i18n.t("settings:profile_sort_most_replies"),
} as const;

import type { PostSearchDocument, PostSearchOptions } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState } from "@rezics/ui";
import { Avatar, AvatarFallback, AvatarImage, Button } from "@rezics/ui/shadcn";
import type { FC } from "react";
import { useState } from "react";
import { useLocalizedPostSearch } from "@/shared/hooks/useLocalizedMeiliSearch";
import { Link } from "@/shared/ui/link";
import { FilterBar, type FilterBarConfig } from "@/user/components/FilterBar";
import {
  type ChipDefinition,
  InnerFilterPanel,
} from "@/user/components/InnerFilterPanel";
import { useProfileContext } from "@/user/components/ProfileLayout";

const KIND_CHIP_LABEL = {
  REVIEW: i18nMessages.search_category_reviews,
  REMARK: i18nMessages.search_category_remarks,
  EXCERPT: i18nMessages.search_category_excerpts,
  POST: i18nMessages.search_category_posts,
} as const satisfies Record<string, () => string>;

const SORT_OPTION_LABEL = {
  "createdAt:desc": i18nMessages.shelf_sort_newest,
  "createdAt:asc": i18nMessages.shelf_sort_oldest,
  "replyCount:desc": i18nMessages.profile_sort_most_replies,
} as const satisfies Record<string, () => string>;

export const ContentTabSection: FC = () => {
  const { t } = useTranslation([
    "common",
    "community",
    "entity",
    "search",
    "settings",
  ]);
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

  const { data, isLoading } = useLocalizedPostSearch(searchOpts);

  const filterConfig: FilterBarConfig = {
    showSearch: true,
    searchPlaceholder: t("settings:profile_search_content_placeholder"),
    dropdowns: [
      {
        key: "sort",
        label: t("entity:shelf_controls_sort_by"),
        options: Object.entries(SORT_OPTION_LABEL).map(([value, label]) => ({
          value,
          label: label(),
        })),
      },
    ],
  };
  const kindChips: ChipDefinition[] = Object.entries(KIND_CHIP_LABEL).map(
    ([value, label]) => ({
      value,
      label: label(),
    }),
  );

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
        chips={kindChips}
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
          {t("common:loading")}
        </p>
      ) : posts.length === 0 ? (
        <EmptyState
          title={filters.q ? t("search:empty_title") : t("common:no_data")}
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
                {t("common:previous_page")}
              </Button>
              <span className="text-sm text-text-secondary">
                {t("common:page_of", {
                  page: currentPage + 1,
                  total: totalPages,
                })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOffset(offset + limit)}
                disabled={currentPage + 1 >= totalPages}
              >
                {t("common:next_page")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const PostListItem: FC<{ post: PostSearchDocument }> = ({ post }) => {
  const { t } = useTranslation(["community", "settings"]);
  const targetTitle = post.targetTitles?.[0];
  const date = formatDate(post.createdAt);
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
                  {t("settings:profile_content_on_target", {
                    title: targetTitle,
                  })}
                </Link>
              ) : (
                <span className="text-sm text-text-secondary">
                  {t("settings:profile_content_on_target", {
                    title: targetTitle,
                  })}
                </span>
              ))}
            <span className="text-xs text-text-secondary">{date}</span>
          </div>
          {post.contentText && (
            <p className="text-sm mt-1 line-clamp-3">{post.contentText}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
            {post.replyCount > 0 && (
              <span>
                {t("community:reply_count", { count: post.replyCount })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
