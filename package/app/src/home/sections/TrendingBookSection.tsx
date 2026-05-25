import { Button } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import React from "react";
import { ResponsiveBookGridLimited } from "@/book-library/components/list/ResponsiveBookGridLimited";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookDescription,
  getBookTitle,
} from "@/shared/utils/translation-helpers";
import { useHomeBooks } from "./hooks/hooks";
import { useMessage } from "@rezics/i18n/react";
import {
  page_home_sections_trending_book_loading,
  page_home_sections_trending_book_more,
  page_home_sections_trending_book_title,
} from "@rezics/i18n/messages";
const i18nMessages = {
  page_home_sections_trending_book_loading,
  page_home_sections_trending_book_more,
  page_home_sections_trending_book_title,
};

export interface TrendingBookSectionProps {
  limit?: number;
  className?: string;
}

export const TrendingBookSection: React.FC<TrendingBookSectionProps> = ({
  limit = 12,
  className,
}) => {
  const m = useMessage(i18nMessages);
  const navigate = useNavigate();
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
          {m.page_home_sections_trending_book_title()}
        </h2>
        <Button variant="ghost" onClick={() => navigate({ to: "/book" })}>
          {m.page_home_sections_trending_book_more()}
        </Button>
      </div>
      {isLoading ? (
        <div className="text-slate-400 text-sm">
          {m.page_home_sections_trending_book_loading()}
        </div>
      ) : (
        <ResponsiveBookGridLimited bookList={bookList} />
      )}
    </section>
  );
};
