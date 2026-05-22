import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { EmptyState } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "@rezics/i18n/react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { ReviewList } from "../components/list/ReviewList";

interface ReviewListSectionProps {
  targetUnitId: string;
  limit?: number;
}

export const ReviewListSection: React.FC<ReviewListSectionProps> = ({
  targetUnitId,
  limit = 20,
}) => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    ...postQueries.byTarget(targetUnitId, { kind: PostKind.REVIEW, limit }),
    enabled: !!targetUnitId,
  });

  if (isLoading) return <div>{t("common.loading")}</div>;
  if (error) return <QueryErrorDisplay error={error} />;

  const reviews = data?.posts ?? [];
  if (reviews.length === 0) {
    return <EmptyState title={t("review.list.empty.title")} />;
  }

  return <ReviewList reviews={reviews} showTargetWork={false} />;
};
