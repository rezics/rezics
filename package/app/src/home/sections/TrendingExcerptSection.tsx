import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { HorizontalExcerptCarousel } from "@/excerpt/components/list/HorizontalExcerptCarousel";
import { useHomeExcerpts } from "./hooks/hooks";
import { useMessage } from "@rezics/i18n/react";
import {
  page_home_sections_trending_excerpt_empty,
  page_home_sections_trending_excerpt_more,
  page_home_sections_trending_excerpt_title,
} from "@rezics/i18n/messages";
const m = {
  page_home_sections_trending_excerpt_empty,
  page_home_sections_trending_excerpt_more,
  page_home_sections_trending_excerpt_title,
};

const i18nMessages = {
  page_home_sections_trending_excerpt_empty,
  page_home_sections_trending_excerpt_more,
  page_home_sections_trending_excerpt_title,
};

export type TrendingExcerptSectionProps = {
  title?: string;
  limit?: number;
};

export const TrendingExcerptSection: React.FC<TrendingExcerptSectionProps> = ({
  title,
  limit = 8,
}) => {
  const m = useMessage(i18nMessages);
  const navigate = useNavigate();
  const resolvedTitle = title ?? m.page_home_sections_trending_excerpt_title();
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
          {m.page_home_sections_trending_excerpt_more()}
        </Button>
      </div>

      {isLoading && <Spinner size="sm" />}

      {!isLoading && !items.length && (
        <p className="text-sm text-text-secondary">
          {m.page_home_sections_trending_excerpt_empty()}
        </p>
      )}

      <div>
        <HorizontalExcerptCarousel excerptList={items} />
      </div>
    </div>
  );
};

export default TrendingExcerptSection;
