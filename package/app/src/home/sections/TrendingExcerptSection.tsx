import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { QueryErrorDisplay } from "@/core";
import { HorizontalExcerptCarousel } from "@/excerpt";
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

  if (error) {
    return (
      <div className="w-full">
        <h6 className="text-base font-semibold mb-3">{resolvedTitle}</h6>
        <QueryErrorDisplay error={error instanceof Error ? error : null} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{resolvedTitle}</h2>
        <Button variant="ghost" onClick={handleMoreClick}>
          {t("page:home_sections_trending_excerpt_more")}
        </Button>
      </div>

      {isLoading && <Spinner size="sm" />}

      {!isLoading && !items.length && (
        <p className="text-sm text-text-secondary">
          {t("page:home_sections_trending_excerpt_empty")}
        </p>
      )}

      <div>
        <HorizontalExcerptCarousel excerptList={items} />
      </div>
    </div>
  );
};
