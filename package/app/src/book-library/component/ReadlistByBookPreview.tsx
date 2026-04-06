import { buildMeiliReadlistQuery } from "@rezics/api/meili/meili.queries";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { HorizontalReadListCarousel } from "@/readlist/component/list/HorizontalReadListCarousel.tsx";

export function ReadlistByBookPreview({
  title,
  bookId,
  readlistNumber = 12,
}: {
  title: string;
  bookId?: string;
  readlistNumber?: number;
}) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery(
    buildMeiliReadlistQuery(0, readlistNumber, "", [], { bookId }),
  );

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
      <ArrowForwardIcon size={16} to={`/readlist/book/${bookId}`}>
        <AccentBarWithText
          text={t("readlist.includes_book_title", { title })}
        />
      </ArrowForwardIcon>
      <div className="mb-4" />
      <HorizontalReadListCarousel
        readlistList={data?.readlists?.slice(0, readlistNumber) || []}
      />
    </div>
  );
}
