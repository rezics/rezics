import { Button } from "@rezics/ui/shadcn";
import { Spinner } from "@rezics/ui";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resolvedTitle = title ?? t("page.home.sections.trending_excerpt.title");
  const { items, isLoading, error } = useHomeExcerpts(limit);

  const handleMoreClick = () => {
    const first = items[0];
    if (first?.workUnitId) {
      navigate({
        to: "/excerpt/book/$bookId",
        params: { bookId: first.workUnitId },
      });
      return;
    }
    if (first?.id) {
      navigate({ to: "/excerpt/$unitId", params: { unitId: first.id } });
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
          {t("page.home.sections.trending_excerpt.more")}
        </Button>
      </div>

      {isLoading && <Spinner size="sm" />}

      {!isLoading && !items.length && (
        <p className="text-sm text-rezics-color-fg-muted">
          {t("page.home.sections.trending_excerpt.empty")}
        </p>
      )}

      <div>
        <HorizontalExcerptCarousel excerptList={items} />
      </div>
    </div>
  );
};

export default TrendingExcerptSection;
