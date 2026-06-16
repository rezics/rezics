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
