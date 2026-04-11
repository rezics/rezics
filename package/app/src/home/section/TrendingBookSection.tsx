import { Button } from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import React from "react";
import { ResponsiveBookGridLimited } from "@/book-library/component/list/ResponsiveBookGridLimited";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookDescription,
  getBookTitle,
} from "@/shared/util/translation-helpers";
import { useHomeBooks } from "./hooks/hooks";

export interface TrendingBookSectionProps {
  limit?: number;
  className?: string;
}

export const TrendingBookSection: React.FC<TrendingBookSectionProps> = ({
  limit = 12,
  className,
}) => {
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
        <h2 className="font-semibold">趋势好书</h2>
        <Button
          variant="text"
          color="primary"
          onClick={() => navigate({ to: "/book" })}
        >
          更多 →
        </Button>
      </div>
      {isLoading ? (
        <div className="text-slate-400 text-sm">Loading...</div>
      ) : (
        <ResponsiveBookGridLimited bookList={bookList} />
      )}
    </section>
  );
};
