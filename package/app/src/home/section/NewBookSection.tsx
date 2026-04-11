import { Button, Tab, Tabs } from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import React from "react";
import { HorizontalBookCarousel } from "@/book-library/component/list/HorizontalBookCarousel";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookDescription,
  getBookTitle,
} from "@/shared/util/translation-helpers";
import { useHomeBooks } from "./hooks/hooks";

type TabKey = "latest" | "new" | "completed";

export interface NewBookSectionProps {
  limit?: number;
  className?: string;
}

export const NewBookSection: React.FC<NewBookSectionProps> = ({
  limit = 12,
  className,
}) => {
  const [tab, setTab] = React.useState<TabKey>("latest");
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">最新作品</h2>
        <Button
          variant="text"
          color="primary"
          onClick={() => navigate({ to: "/book" })}
        >
          更多 →
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-4">
        <Tabs value={tab} onChange={(_, value) => setTab(value)}>
          <Tab value="latest" label="最新连载" />
          <Tab value="new" label="最新上架" />
          <Tab value="completed" label="近期完结" />
        </Tabs>
      </div>

      {/* Content */}
      <div>
        {isLoading ? (
          <div className="text-slate-400 text-sm">Loading...</div>
        ) : (
          <HorizontalBookCarousel bookList={bookList} />
        )}
      </div>
    </section>
  );
};
