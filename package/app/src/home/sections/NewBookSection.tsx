import { useTranslation } from "@rezics/i18n/react";
import { Button, Tabs, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import React from "react";
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
  const { t } = useTranslation(["page"]);
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
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          {t("page:home_sections_new_book_title")}
        </h2>
        <Button variant="ghost" onClick={() => navigate({ to: "/book" })}>
          {t("page:home_sections_new_book_more")}
        </Button>
      </div>

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

      <div>
        {isLoading ? (
          <div className="text-slate-400 text-sm">
            {t("page:home_sections_trending_book_loading")}
          </div>
        ) : (
          <HorizontalBookCarousel bookList={bookList} />
        )}
      </div>
    </section>
  );
};
