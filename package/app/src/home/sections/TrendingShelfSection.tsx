import type { ShelfDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { buttonVariants } from "@rezics/ui/shadcn";
import { Link } from "@tanstack/react-router";
import type React from "react";
import { useMemo } from "react";
import { QueryErrorDisplay } from "@/core";
import { useLocalizedContentSearch } from "@/shared/hooks/useLocalizedMeiliSearch";
import {
  HorizontalShelfCarousel,
  mapContentSearchDocToShelfDTO,
} from "@/shelf";

export type TrendingShelfSectionProps = {
  title?: string;
  limit?: number;
};

/**
 * Home section displaying trending/most popular shelves in a horizontal carousel.
 * 主页部分在水平轮播中显示热门/最受欢迎的书架。
 *
 * Searches for SHELF type content sorted by trending metrics.
 * Displays shelves in a scrollable carousel with metadata and links.
 * 搜索 SHELF 类型内容，按趋势指标排序。
 * 在可滚动轮播中显示书架，带有元数据和链接。
 *
 * Desktop (md+):
 * ┌──────────────────────────────────────────┐
 * │ Trending Shelves               [More]    │
 * │ ┌────────────────────┬──────────────────┐│
 * │ │ Cover/Icon  Shelf 1│ 234 items        ││
 * │ │                    │ 45 followers     ││
 * │ └────────────────────┴──────────────────┘│
 * │ ┌────────────────────┬──────────────────┐│
 * │ │ Shelf 2            │ 189 items        ││
 * │ │                    │ 32 followers     ││
 * │ └────────────────────┴──────────────────┘│
 * └──────────────────────────────────────────┘
 *
 * Tablet (sm-md):
 * ┌──────────────────────────┐
 * │ Shelves        [More]    │
 * │ ┌──────────────────────┐ │
 * │ │ Shelf 1              │ │
 * │ │ 234 items [→]        │ │
 * │ └──────────────────────┘ │
 * │ ┌──────────────────────┐ │
 * │ │ Shelf 2 ...          │ │
 * │ └──────────────────────┘ │
 * └──────────────────────────┘
 *
 * Mobile (xs-sm):
 * ┌────────────────────┐
 * │ Shelves [More]     │
 * │ ┌────────────────┐ │
 * │ │ Shelf 1        │ │
 * │ │ 234 items      │ │
 * │ │ (swipeable) >  │ │
 * │ └────────────────┘ │
 * └────────────────────┘
 *
 * Loading state:
 * ┌──────────────────────────────────────────┐
 * │ Trending Shelves                         │
 * │ ⟳ Loading...                             │
 * └──────────────────────────────────────────┘
 *
 * Error state:
 * ┌──────────────────────────────────────────┐
 * │ Trending Shelves                         │
 * │ [Error loading shelves] [Retry]          │
 * └──────────────────────────────────────────┘
 */
export const TrendingShelfSection: React.FC<TrendingShelfSectionProps> = ({
  title,
  limit = 8,
}) => {
  const { t } = useTranslation(["page"]);
  const resolvedTitle = title ?? t("page:home_sections_trending_shelves");
  const { data, isLoading, error } = useLocalizedContentSearch({
    type: "SHELF",
    offset: 0,
    limit,
  });

  // Map content search docs to ShelfDTO shape (id -> unitId, translations, etc.)
  // 将内容搜索文档映射为 ShelfDTO 形状（id -> unitId、翻译等）
  const items = useMemo<ShelfDTO[]>(
    () => (data?.items ?? []).map(mapContentSearchDocToShelfDTO),
    [data],
  );

  if (error) {
    return (
      <div className="w-full">
        <h6 className="text-base font-semibold mb-3">{resolvedTitle}</h6>
        <QueryErrorDisplay error={error} />
      </div>
    );
  }

  return (
    <div className="w-full @container">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{resolvedTitle}</h2>
        <Link to="/shelf" className={buttonVariants({ variant: "ghost" })}>
          {t("common:more")}
        </Link>
      </div>

      {isLoading && <Spinner size="sm" />}

      <div>
        <HorizontalShelfCarousel shelves={items} />
      </div>
    </div>
  );
};
