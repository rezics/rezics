import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { HorizontalExcerptCarousel } from "@/excerpt";
import { HomeSectionShell } from "./HomeSectionShell";
import { useHomeExcerpts } from "./hooks/hooks";

export type TrendingExcerptSectionProps = {
  title?: string;
  limit?: number;
};

/**
 * Home section displaying trending book excerpts in a horizontal carousel.
 * 主页部分在水平轮播中显示热门书籍摘录。
 *
 * Loads excerpts and displays them in a scrollable carousel.
 * "More" button navigates to the first excerpt's book or excerpt listing.
 * 加载摘录并在可滚动轮播中显示它们。
 * "更多"按钮导航到第一个摘录的书籍或摘录列表。
 *
 * Desktop (md+):
 * ┌──────────────────────────────────────────┐
 * │ Trending Excerpts              [More →]  │
 * │ ┌──────────────────────────┬──────┐     │
 * │ │ Excerpt text preview...  │ Book │     │
 * │ │ Author: John Doe         │ 1    │     │
 * │ │ Rating: ★★★★☆           │      │     │
 * │ └──────────────────────────┴──────┘     │
 * │ ┌──────────────────────────┬──────┐     │
 * │ │ Another excerpt...       │ Book │ ... │
 * │ └──────────────────────────┴──────┘     │
 * └──────────────────────────────────────────┘
 *
 * Tablet (sm-md):
 * ┌──────────────────────────┐
 * │ Excerpts       [More →]  │
 * │ ┌────────────────────┐   │
 * │ │ Excerpt text...    │ > │
 * │ │ Author: Name       │   │
 * │ │ Rating: ★★★★☆     │   │
 * │ └────────────────────┘   │
 * └──────────────────────────┘
 *
 * Mobile (xs-sm):
 * ┌────────────────────┐
 * │ Excerpts [More]    │
 * │ ┌────────────────┐ │
 * │ │ Text...        │ │
 * │ │ Author: Name   │ │
 * │ │ ★★★★☆         │ │
 * │ │ (swipeable) >  │ │
 * │ └────────────────┘ │
 * └────────────────────┘
 *
 * Empty state:
 * ┌──────────────────────────────────────────┐
 * │ Trending Excerpts              [More →]  │
 * │                                          │
 * │ No excerpts available yet.               │
 * └──────────────────────────────────────────┘
 *
 * Error state:
 * ┌──────────────────────────────────────────┐
 * │ Trending Excerpts                        │
 * │ [Error loading excerpts] [Retry]         │
 * └──────────────────────────────────────────┘
 */
export const TrendingExcerptSection: React.FC<TrendingExcerptSectionProps> = ({
  title,
  limit = 8,
}) => {
  const { t } = useTranslation(["page"]);
  const navigate = useNavigate();
  const resolvedTitle = title ?? t("page:home_sections_trending_excerpt_title");
  const { items, isLoading, error } = useHomeExcerpts(limit);

  const handleMoreClick = () => {
    const first = items[0];
    if (first?.id) {
      navigate({
        to: "/excerpt/book/$bookId",
        params: { bookId: first.id },
      });
      return;
    }
    navigate({ to: "/review" });
  };

  return (
    <HomeSectionShell
      title={resolvedTitle}
      isLoading={isLoading}
      error={error}
      more={
        <Button variant="ghost" onClick={handleMoreClick}>
          {t("page:home_sections_trending_excerpt_more")}
        </Button>
      }
    >
      {!isLoading && !items.length && (
        <p className="text-sm text-text-secondary">
          {t("page:home_sections_trending_excerpt_empty")}
        </p>
      )}
      <HorizontalExcerptCarousel excerptList={items} />
    </HomeSectionShell>
  );
};
