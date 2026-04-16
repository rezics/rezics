import { Button, CircularProgress, Typography } from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/component/QueryErrorDisplay";
import { HorizontalQuoteCarousel } from "@/quote/component/list/HorizontalQuoteCarousel";
import { useHomeQuotes } from "./hooks/hooks";

export type TrendingQuoteSectionProps = {
  title?: string;
  limit?: number;
};

export const TrendingQuoteSection: React.FC<TrendingQuoteSectionProps> = ({
  title,
  limit = 8,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resolvedTitle = title ?? t("page.home.sections.trending_quote.title");
  const { items, isLoading, error } = useHomeQuotes(limit);

  const handleMoreClick = () => {
    const first = items[0];
    if (first?.workUnitId) {
      navigate({ to: "/quote/book/$bookId", params: { bookId: first.workUnitId } });
      return;
    }
    if (first?.id) {
      navigate({ to: "/quote/$unitId", params: { unitId: first.id } });
      return;
    }
    navigate({ to: "/review" });
  };

  if (error) {
    return (
      <div className="w-full">
        <Typography variant="h6" className="mb-3">
          {resolvedTitle}
        </Typography>
        <QueryErrorDisplay error={error instanceof Error ? error : null} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{resolvedTitle}</h2>
        <Button variant="text" color="primary" onClick={handleMoreClick}>
          {t("page.home.sections.trending_quote.more")}
        </Button>
      </div>

      {isLoading && <CircularProgress size={20} />}

      {!isLoading && !items.length && (
        <Typography variant="body2" color="text.secondary">
          {t("page.home.sections.trending_quote.empty")}
        </Typography>
      )}

      <div>
        <HorizontalQuoteCarousel quoteList={items} />
      </div>
    </div>
  );
};

export default TrendingQuoteSection;
