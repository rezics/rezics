import { shelfQueries } from "@rezics/api/shelf/shelf";
import { useTranslation } from "@rezics/i18n/react";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorDisplay } from "@/core";
import { HorizontalShelfCarousel } from "@/shelf";

export function ShelfByBookPreview({
  title,
  bookId,
  variantUnitId,
  shelfNumber = 12,
}: {
  title: string;
  bookId?: string;
  variantUnitId?: string;
  shelfNumber?: number;
}) {
  const { t } = useTranslation(["common", "entity"]);
  const { data, isLoading, error } = useQuery({
    ...shelfQueries.list(
      variantUnitId
        ? { variantUnitId, limit: shelfNumber }
        : { containsUnitId: bookId, limit: shelfNumber },
    ),
    enabled: Boolean(variantUnitId || bookId),
  });

  if (isLoading) {
    return <div>{t("common:loading")}</div>;
  }
  if (error) return <QueryErrorDisplay error={error} />;

  return (
    <div className="@container">
      <ArrowForwardIcon size={16} to={`/shelf/book/${bookId}`}>
        <AccentBarWithText
          text={t("entity:shelf_includes_book_title", { title })}
        />
      </ArrowForwardIcon>
      <div className="mb-4" />
      <HorizontalShelfCarousel
        shelves={data?.shelves?.slice(0, shelfNumber) || []}
      />
    </div>
  );
}
