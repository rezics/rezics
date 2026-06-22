import type { PostDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useMemo } from "react";
import { HorizontalReviewCarousel, mapPostSearchDocToPostDTO } from "@/review";
import { useLocalizedPostSearch } from "@/shared/hooks/useLocalizedMeiliSearch";
import { HomeSectionShell } from "./HomeSectionShell";

export type TrendingReviewsProps = {
  title?: string;
  limit?: number;
};

/**
 * Home section displaying trending reviews in a horizontal carousel.
 * 主页部分在水平轮播中显示热门评论。
 *
 * Queries reviews sorted by trending score with localization support.
 * Displays reviews in a scrollable carousel with "More" link to full review listing.
 * 查询按趋势得分排序的评论，支持本地化。
 * 在可滚动轮播中显示评论，带有"更多"链接到完整评论列表。
 *
 * Desktop (md+):
 * ┌──────────────────────────────────────────┐
 * │ Trending Reviews               [More →]  │
 * │ ┌────────────────────┬─────────────────┐ │
 * │ │ ★★★★★ 5/5         │ Review Title    │ │
 * │ │ Great book!        │ By: User Name   │ │
 * │ │ "Loved every page" │ Date: 2 days ago│ │
 * │ └────────────────────┴─────────────────┘ │
 * │ ┌────────────────────┬─────────────────┐ │
 * │ │ ★★★☆☆ 3/5         │ Another Title   │ │
 * │ └────────────────────┴─────────────────┘ │
 * └──────────────────────────────────────────┘
 *
 * Tablet (sm-md):
 * ┌──────────────────────────┐
 * │ Reviews        [More →]  │
 * │ ┌──────────────────────┐ │
 * │ │ ★★★★★ Review 1     │ │
 * │ │ "Great read" [→]    │ │
 * │ └──────────────────────┘ │
 * │ ┌──────────────────────┐ │
 * │ │ ★★★☆☆ Review 2 ... │ │
 * │ └──────────────────────┘ │
 * └──────────────────────────┘
 *
 * Mobile (xs-sm):
 * ┌────────────────────┐
 * │ Reviews [More]     │
 * │ ┌────────────────┐ │
 * │ │ ★★★★★         │ │
 * │ │ Great book!    │ │
 * │ │ By: User Name  │ │
 * │ │ (swipeable) >  │ │
 * │ └────────────────┘ │
 * └────────────────────┘
 *
 * Loading state:
 * ┌──────────────────────────────────────────┐
 * │ Trending Reviews                         │
 * │ ⟳ Loading...                             │
 * └──────────────────────────────────────────┘
 *
 * Error state:
 * ┌──────────────────────────────────────────┐
 * │ Trending Reviews                         │
 * │ [Error loading reviews] [Retry]          │
 * └──────────────────────────────────────────┘
 */
export const TrendingReviews: React.FC<TrendingReviewsProps> = ({
  title,
  limit = 8,
}) => {
  const { t } = useTranslation(["page"]);
  const resolvedTitle = title ?? t("page:home_sections_trending_reviews");
  const navigate = useNavigate();
  const { data, isLoading, error } = useLocalizedPostSearch({
    kind: "REVIEW",
    sort: { field: "trendingScore", order: "desc" },
    offset: 0,
    limit,
  });

  const items = useMemo<PostDTO[]>(
    () => data?.items?.map(mapPostSearchDocToPostDTO) ?? [],
    [data],
  );

  return (
    <HomeSectionShell
      title={resolvedTitle}
      isLoading={isLoading}
      error={error}
      more={
        <Button variant="ghost" onClick={() => navigate({ to: "/review" })}>
          {t("page:home_sections_trending_reviews")} →
        </Button>
      }
    >
      <HorizontalReviewCarousel reviewList={items} />
    </HomeSectionShell>
  );
};
