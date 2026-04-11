import { Alert, Button, CircularProgress, Typography } from "@mui/material";
// MOCK: meili review queries may need updating when backend is ready
import { buildMeiliReviewQuery } from "@rezics/api/meili/meili.queries";
import type { PostDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { HorizontalReviewCarousel } from "@/review/component/list/HorizontalReviewCarousel";

export type TrendingReviewsProps = {
  title?: string;
  limit?: number;
};

/**
 * HomeTrendingReviews
 * Placeholder: uses books as anchors to show review-like snippets.
 */
export const TrendingReviews: React.FC<TrendingReviewsProps> = ({
  title,
  limit = 8,
}) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("page.home.sections.trending_reviews");
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery(
    buildMeiliReviewQuery(0, limit, {}),
  );

  // MOCK: data shape may change when meili queries are updated
  const items = useMemo<PostDTO[]>(() => (data as any)?.reviews ?? (data as any)?.posts ?? [], [data]);
  const _total: number | undefined = data?.total;

  if (error) {
    return (
      <div className="w-full">
        <Typography variant="h6" className="mb-3">
          {resolvedTitle}
        </Typography>
        <Alert severity="error">{String(error)}</Alert>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{resolvedTitle}</h2>
        <Button
          variant="text"
          color="primary"
          onClick={() => navigate({ to: "/book" })}
        >
          更多 →
        </Button>
      </div>
      {isLoading && <CircularProgress size={20} />}
      <div>
        <HorizontalReviewCarousel reviewList={items} />
      </div>
    </div>
  );
};

export default TrendingReviews;
