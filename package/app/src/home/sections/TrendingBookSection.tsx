import { useTranslation } from "@rezics/i18n/react";
import { buttonVariants } from "@rezics/ui/shadcn";
import React from "react";
import { ResponsiveBookGridLimited } from "@/book-library";
import { AppSafeLink } from "@/shared/ui/link";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookDescription,
  getBookTitle,
} from "@/shared/utils/translation-helpers";
import { officialZoneHref } from "@/zone";
import { useHomeBooks } from "./hooks/hooks";

export interface TrendingBookSectionProps {
  limit?: number;
  className?: string;
}

/**
 * Home section displaying trending/most popular books in a responsive grid.
 * 主页部分在响应式网格中显示热门/最受欢迎的书籍。
 *
 * Fetches and renders books in a grid layout that adapts to screen size.
 * Includes loading state and "View All" link to full book library.
 * 在适应屏幕大小的网格布局中获取和呈现书籍。
 * 包括加载状态和"查看全部"链接到完整书库。
 *
 * Desktop (md+):
 * ┌──────────────────────────────────────────┐
 * │ Trending Books                 [View All] │
 * │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
 * │ │Cover │ │Cover │ │Cover │ │Cover │      │
 * │ │Book 1│ │Book 2│ │Book 3│ │Book 4│      │
 * │ │Author│ │Author│ │Author│ │Author│      │
 * │ └──────┘ └──────┘ └──────┘ └──────┘      │
 * │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
 * │ │ 5  │ │ 6  │ │ 7  │ │ 8  │      │
 * │ └──────┘ └──────┘ └──────┘ └──────┘      │
 * └──────────────────────────────────────────┘
 *
 * Tablet (sm-md):
 * ┌──────────────────────────┐
 * │ Trending Books[View All] │
 * │ ┌──────┐ ┌──────┐       │
 * │ │Cover │ │Cover │       │
 * │ │Book 1│ │Book 2│       │
 * │ ├──────┤ ├──────┤       │
 * │ │ 3  │ │ 4  │       │
 * │ └──────┘ └──────┘       │
 * └──────────────────────────┘
 *
 * Mobile (xs-sm):
 * ┌────────────────────┐
 * │Trending [View All] │
 * │ ┌──────────────┐   │
 * │ │ Book Cover   │   │
 * │ │ Book 1       │   │
 * │ │ Author       │   │
 * │ └──────────────┘   │
 * │ ┌──────────────┐   │
 * │ │ Book 2       │   │
 * │ └──────────────┘   │
 * └────────────────────┘
 *
 * Loading state:
 * ┌──────────────────────────────────────────┐
 * │ Trending Books                           │
 * │ Loading...                               │
 * └──────────────────────────────────────────┘
 */
export const TrendingBookSection: React.FC<TrendingBookSectionProps> = ({
  limit = 12,
  className,
}) => {
  const { t } = useTranslation(["page"]);
  const { items = [], isLoading } = useHomeBooks(limit);

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

  return (
    <section className={className}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">
          {t("page:home_sections_trending_book_title")}
        </h2>
        <AppSafeLink
          href={officialZoneHref("book")}
          className={buttonVariants({ variant: "ghost" })}
        >
          {t("page:home_sections_trending_book_more")}
        </AppSafeLink>
      </div>
      {isLoading ? (
        <div className="text-slate-400 text-sm">
          {t("page:home_sections_trending_book_loading")}
        </div>
      ) : (
        <ResponsiveBookGridLimited bookList={bookList} />
      )}
    </section>
  );
};
