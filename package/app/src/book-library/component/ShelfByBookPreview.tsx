import { shelfQueries } from "@rezics/api/shelf/shelf";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { HorizontalShelfCarousel } from "@/shelf/component/HorizontalShelfCarousel";

export function ShelfByBookPreview({
  title,
  bookId,
  shelfNumber = 12,
}: {
  title: string;
  bookId?: string;
  shelfNumber?: number;
}) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    ...shelfQueries.list({
      containsItemUnitId: bookId,
      limit: shelfNumber,
    }),
    enabled: !!bookId,
  });

  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }
  if (error && error instanceof Error)
    return (
      <div>
        {t("common.error")}: {error.message}
      </div>
    );

  return (
    <div className="@container">
      <ArrowForwardIcon size={16} to={`/shelf/book/${bookId}`}>
        <AccentBarWithText
          text={t("shelf.includes_book_title", { title })}
        />
      </ArrowForwardIcon>
      <div className="mb-4" />
      <HorizontalShelfCarousel
        shelves={data?.shelves?.slice(0, shelfNumber) || []}
      />
    </div>
  );
}
