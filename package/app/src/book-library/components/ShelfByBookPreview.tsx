import { shelfQueries } from "@rezics/api/shelf/shelf";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { HorizontalShelfCarousel } from "@/shelf/components/HorizontalShelfCarousel";
import { useMessage } from "@rezics/i18n/react";
import {
  common_loading,
  shelf_includes_book_title,
} from "@rezics/i18n/messages";
const i18nMessages = {
  common_loading,
  shelf_includes_book_title,
};

export function ShelfByBookPreview({
  title,
  bookId,
  shelfNumber = 12,
}: {
  title: string;
  bookId?: string;
  shelfNumber?: number;
}) {
  const m = useMessage(i18nMessages);
  const { data, isLoading, error } = useQuery({
    ...shelfQueries.list({
      containsUnitId: bookId,
      limit: shelfNumber,
    }),
    enabled: !!bookId,
  });

  if (isLoading) {
    return <div>{m.common_loading()}</div>;
  }
  if (error) return <QueryErrorDisplay error={error} />;

  return (
    <div className="@container">
      <ArrowForwardIcon size={16} to={`/shelf/book/${bookId}`}>
        <AccentBarWithText text={m.shelf_includes_book_title({ title })} />
      </ArrowForwardIcon>
      <div className="mb-4" />
      <HorizontalShelfCarousel
        shelves={data?.shelves?.slice(0, shelfNumber) || []}
      />
    </div>
  );
}
