import { Button } from "@rezics/ui/shadcn";
import { Spinner } from "@rezics/ui";
import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import type { PostDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useMemo } from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { HorizontalReviewCarousel } from "@/review/components/list/HorizontalReviewCarousel";
import * as m from "@rezics/i18n/messages";

export type TrendingReviewsProps = {
  title?: string;
  limit?: number;
};

export const TrendingReviews: React.FC<TrendingReviewsProps> = ({
  title,
  limit = 8,
}) => {
  const resolvedTitle = title ?? m.page_home_sections_trending_reviews();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery(
    contentSearchQueryOptions({ type: "POST", offset: 0, limit }),
  );

  const items = useMemo<PostDTO[]>(
    () => (data?.items ?? []) as unknown as PostDTO[],
    [data],
  );

  if (error) {
    return (
      <div className="w-full">
        <h6 className="text-base font-semibold mb-3">{resolvedTitle}</h6>
        <QueryErrorDisplay error={error} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{resolvedTitle}</h2>
        <Button variant="ghost" onClick={() => navigate({ to: "/review" })}>
          {m.page_home_sections_trending_reviews()} →
        </Button>
      </div>
      {isLoading && <Spinner size="sm" />}
      <div>
        <HorizontalReviewCarousel reviewList={items} />
      </div>
    </div>
  );
};

export default TrendingReviews;
