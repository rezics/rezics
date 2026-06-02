import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { useReadLanguageCandidates } from "@/shared/hooks/useReadLanguageCandidates";
import { ReviewList } from "../components/list/ReviewList";

interface ReviewListSectionProps {
  targetUnitId: string;
  limit?: number;
}

export const ReviewListSection: React.FC<ReviewListSectionProps> = ({
  targetUnitId,
  limit = 20,
}) => {
  const { t } = useTranslation(["common", "community"]);
  const languages = useReadLanguageCandidates();
  const { data, isLoading, error } = useQuery({
    ...postQueries.byTarget(targetUnitId, {
      kind: PostKind.REVIEW,
      languages,
      limit,
    }),
    enabled: !!targetUnitId,
  });

  if (isLoading) return <div>{t("common:loading")}</div>;
  if (error) return <QueryErrorDisplay error={error} />;

  const reviews = data?.posts ?? [];
  if (reviews.length === 0) {
    return <EmptyState title={t("community:review_list_empty_title")} />;
  }

  return <ReviewList reviews={reviews} showTargetUnit={false} />;
};
