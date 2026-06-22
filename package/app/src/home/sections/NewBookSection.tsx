import { useTranslation } from "@rezics/i18n/react";
import { Tabs, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import React from "react";
import { HorizontalBookCarousel } from "@/book-library";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookDescription,
  getBookTitle,
} from "@/shared/utils/translation-helpers";
import { officialZoneHref } from "@/zone";
import { HomeSectionShell } from "./HomeSectionShell";
import { useHomeBooks } from "./hooks/hooks";

type TabKey = "latest" | "new" | "completed";

export interface NewBookSectionProps {
  limit?: number;
  className?: string;
}

/**
 * Home section showcasing newly added or updated books with tab filtering.
 * 主页部分展示新增或更新的书籍，带有标签页过滤。
 *
 * Three tabs: Latest Updates, New on Shelf, Recently Completed.
 * Displays books in a horizontal carousel with covers and metadata.
 * 三个标签页：最新更新、架上新书、最近完成。
 * 在水平轮播中显示带有封面和元数据的书籍。
 *
 * Desktop (md+):
 * ┌──────────────────────────────────────────┐
 * │ New Books                      [Browse]   │
 * │ [Latest▼] [New on Shelf] [Completed]     │
 * │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ │
 * │ │Cover│ │Cover│ │Cover│ │Cover│ │Cover│ │
 * │ │Book 1 │ │Book 2 │ │Book 3 │ │Book 4 │ │
 * │ │Author │ │Author │ │Author │ │Author │ │
 * │ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ │
 * └──────────────────────────────────────────┘
 *
 * Tablet (sm-md):
 * ┌──────────────────────────┐
 * │ New Books     [Browse]   │
 * │ [Latest▼][New][Done]     │
 * │ ┌───┐ ┌───┐ ┌───┐       │
 * │ │ 1 │ │ 2 │ │ 3 │ ...   │
 * │ │   │ │   │ │   │       │
 * │ └───┘ └───┘ └───┘       │
 * └──────────────────────────┘
 *
 * Mobile (xs-sm):
 * ┌────────────────────┐
 * │ New Books[Browse]  │
 * │ [L] [N] [C] »      │
 * │ ┌──────┐           │
 * │ │ Book │ >         │
 * │ │ 1    │           │
 * │ └──────┘           │
 * └────────────────────┘
 *
 * Loading state:
 * ┌──────────────────────────────────────────┐
 * │ New Books                                │
 * │ [Latest▼] [New] [Completed]              │
 * │ Loading...                               │
 * └──────────────────────────────────────────┘
 */
export const NewBookSection: React.FC<NewBookSectionProps> = ({
  limit = 12,
  className,
}) => {
  const { t } = useTranslation(["page"]);
  const [tab, setTab] = React.useState<TabKey>("latest");

  const { items = [], isLoading, error } = useHomeBooks(limit);

  const bookList = React.useMemo(() => {
    return items.map((book) => ({
      id: book.unitId,
      title: getBookTitle(book),
      author: getBookAuthorName(book),
      description: getBookDescription(book),
      coverUrl: getBookCoverUrl(book),
      href: `/book/${book.unitId}`,
    }));
  }, [items]);

  // Hide section entirely when query failed and no cached items are available
  // 查询失败且无缓存数据时完全隐藏该区域
  if (error && items.length === 0 && !isLoading) {
    return null;
  }

  return (
    <HomeSectionShell
      title={t("page:home_sections_new_book_title")}
      moreHref={officialZoneHref("book")}
      moreLabel={t("page:home_sections_new_book_more")}
      isLoading={isLoading}
      className={className}
    >
      <div className="mb-4 max-w-full overflow-hidden">
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as TabKey)}
          className="max-w-full"
        >
          <TabsList className="w-full max-w-full justify-start overflow-x-auto overscroll-x-contain scroll-smooth sm:w-fit sm:overflow-visible">
            <TabsTrigger value="latest" className="flex-none">
              {t("page:home_sections_new_book_tab_latest_serial")}
            </TabsTrigger>
            <TabsTrigger value="new" className="flex-none">
              {t("page:home_sections_new_book_tab_new_on_shelf")}
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-none">
              {t("page:home_sections_new_book_tab_recently_completed")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {isLoading ? null : <HorizontalBookCarousel bookList={bookList} />}
    </HomeSectionShell>
  );
};
