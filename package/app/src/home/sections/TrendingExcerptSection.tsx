import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { HorizontalExcerptCarousel } from "@/excerpt/components/list/HorizontalExcerptCarousel";
import { useHomeExcerpts } from "./hooks/hooks";

export type TrendingExcerptSectionProps = {
  title?: string;
  limit?: number;
};

export const TrendingExcerptSection: React.FC<TrendingExcerptSectionProps> = ({
  title,
  limit = 8,
}) => {
  const { t } = useTranslation(["page"]);
  const navigate = useNavigate();
  const resolvedTitle = title ?? t("page:home_sections_trending_excerpt_title");
  const { items, isLoading, error } = useHomeExcerpts(limit);

  const handleMoreClick = () => {
    const first = items[0];
    if (first?.id) {
      navigate({
        to: "/excerpt/book/$bookId",
        params: { bookId: first.id },
      });
      return;
    }
    navigate({ to: "/review" });
  };

  if (error) {
    return (
      <div className="w-full">
        <h6 className="text-base font-semibold mb-3">{resolvedTitle}</h6>
        <QueryErrorDisplay error={error instanceof Error ? error : null} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{resolvedTitle}</h2>
        <Button variant="ghost" onClick={handleMoreClick}>
          {t("page:home_sections_trending_excerpt_more")}
        </Button>
      </div>

      {isLoading && <Spinner size="sm" />}

      {!isLoading && !items.length && (
        <p className="text-sm text-text-secondary">
          {t("page:home_sections_trending_excerpt_empty")}
        </p>
      )}

      <div>
        <HorizontalExcerptCarousel excerptList={items} />
      </div>
    </div>
  );
};

export default TrendingExcerptSection;
