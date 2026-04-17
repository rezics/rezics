import { Button, Tab, Tabs } from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { HorizontalBookCarousel } from "@/book-library/components/list/HorizontalBookCarousel";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookDescription,
  getBookTitle,
} from "@/shared/utils/translation-helpers";
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
  const { t } = useTranslation();
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
        <h2 className="font-semibold">{t("page.home.sections.new_book.title")}</h2>
        <Button
          variant="text"
          color="primary"
          onClick={() => navigate({ to: "/book" })}
        >
          {t("page.home.sections.new_book.more")}
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-4">
        <Tabs value={tab} onChange={(_, value) => setTab(value)}>
          <Tab value="latest" label={t("page.home.sections.new_book.tab_latest_serial")} />
          <Tab value="new" label={t("page.home.sections.new_book.tab_new_on_shelf")} />
          <Tab value="completed" label={t("page.home.sections.new_book.tab_recently_completed")} />
        </Tabs>
      </div>

      {/* Content */}
      <div>
        {isLoading ? (
          <div className="text-slate-400 text-sm">{t("page.home.sections.trending_book.loading")}</div>
        ) : (
          <HorizontalBookCarousel bookList={bookList} />
        )}
      </div>
    </section>
  );
};
