import { Button } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import React from "react";
import { useTranslation } from "@rezics/i18n/react";
import { ResponsiveBookGridLimited } from "@/book-library/components/list/ResponsiveBookGridLimited";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookDescription,
  getBookTitle,
} from "@/shared/utils/translation-helpers";
import { useHomeBooks } from "./hooks/hooks";

export interface TrendingBookSectionProps {
  limit?: number;
  className?: string;
}

export const TrendingBookSection: React.FC<TrendingBookSectionProps> = ({
  limit = 12,
  className,
}) => {
  const { t } = useTranslation();
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
          {t("page.home.sections.trending_book.title")}
        </h2>
        <Button variant="ghost" onClick={() => navigate({ to: "/book" })}>
          {t("page.home.sections.trending_book.more")}
        </Button>
      </div>
      {isLoading ? (
        <div className="text-slate-400 text-sm">
          {t("page.home.sections.trending_book.loading")}
        </div>
      ) : (
        <ResponsiveBookGridLimited bookList={bookList} />
      )}
    </section>
  );
};
