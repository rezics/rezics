import type { ShelfDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@rezics/ui/shadcn";
import type React from "react";
import { useMemo } from "react";
import { useLocalizedContentSearch } from "@/shared/hooks/useLocalizedMeiliSearch";
import {
  HorizontalShelfCarousel,
  mapContentSearchDocToShelfDTO,
} from "@/shelf";
import { HomeSectionShell } from "./HomeSectionShell";

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

  return (
    <HomeSectionShell
      title={resolvedTitle}
      isLoading={isLoading}
      error={error}
      more={
        <Link to="/shelf" className={buttonVariants({ variant: "ghost" })}>
          {t("common:more")}
        </Link>
      }
    >
      <HorizontalShelfCarousel shelves={items} />
    </HomeSectionShell>
  );
};
