import { buildMeiliUnitQuery } from "@rezics/api/meili/meili.queries";
import { UnitType } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { QuoteExcerptListContainer } from "@/review/components/QuoteExcerptList.tsx";

/** Props for QuoteExcerptPreview component. */
export type QuoteExcerptPreviewProps = {
  /** Book or target unit ID. */
  id: string;
  /** Number of quotes to display. */
  quoteNumber?: number;
};

/**
 * Quote Excerpt Preview - Displays a preview of quotes for a book.
 */
export const QuoteExcerptPreview: React.FC<QuoteExcerptPreviewProps> = ({
  id,
  quoteNumber = 3,
}) => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery(
    buildMeiliUnitQuery({
      kind: UnitType.QUOTE,
      start: 0,
      targetUnitId: id,
      keyword: "",
      limit: quoteNumber,
      mapFn: (unitResp: any) => unitResp,
      options: { enabled: !!id },
    }),
  );

  if (isLoading) return <div>{t("common.loading")}</div>;
  if (error) return <QueryErrorDisplay error={error} />;

  return (
    <div>
      <QuoteExcerptListContainer
        data={{
          units: data?.units?.slice(0, quoteNumber) || [],
          total: data?.total,
        }}
      />
    </div>
  );
};

// Legacy export for backward compatibility
export { QuoteExcerptPreview as QuoteExcerptPreviewContainer };
