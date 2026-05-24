import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
import { EmptyState } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
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
  const { data, isLoading, error } = useQuery({
    ...postQueries.byTarget(targetUnitId, { kind: PostKind.REVIEW, limit }),
    enabled: !!targetUnitId,
  });

  if (isLoading) return <div>{m.common_loading()}</div>;
  if (error) return <QueryErrorDisplay error={error} />;

  const reviews = data?.posts ?? [];
  if (reviews.length === 0) {
    return <EmptyState title={m.review_list_empty_title()} />;
  }

  return <ReviewList reviews={reviews} showTargetWork={false} />;
};
