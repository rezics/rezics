import { postQueries } from "@rezics/contract/api/post/post";
import { PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState, Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { ReviewList } from "../components/list/ReviewList";

interface ReviewListSectionProps {
  targetUnitId: string;
  limit?: number;
}

/**
 * Review list section.
 *
 * Queries and displays all reviews targeting a specific unit (e.g., a book).
 * Respects user's language preferences. Shows empty state if no reviews exist.
 *
 * 评论列表区域，查询并显示针对特定 Unit（如书籍）的所有评论。
 * 尊重用户的语言偏好设置。如无评论，显示空状态。
 *
 * Desktop (1200px):
 * +---------------------------------------------+
 * | Reviews of This Book (24)                   |
 * +---------------------------------------------+
 * | [Review 1] - Author 1 | Rating ★★★★★      |
 * | 3 weeks ago | 5 helpful votes               |
 * | Review preview text here...                 |
 * |                                             |
 * | [Review 2] - Author 2 | Rating ★★★★       |
 * | 1 month ago | 3 helpful votes               |
 * +---------------------------------------------+
 *
 * Tablet (768px):
 * +----------------------------------+
 * | Reviews (24)                     |
 * +----------------------------------+
 * | [Review 1]                       |
 * | Author 1 | ★★★★★ | 3 weeks ago  |
 * | Preview...                       |
 * |                                  |
 * | [Review 2]                       |
 * | Author 2 | ★★★★                 |
 * +----------------------------------+
 *
 * Mobile (360px):
 * +----------+
 * | Reviews  |
 * +----------+
 * | Title 1  |
 * | Author 1 |
 * | ★★★★★   |
 * |          |
 * | Title 2  |
 * | Author 2 |
 * +----------+
 *
 * Empty State:
 * +-----------+
 * | No reviews|
 * +-----------+
 */
export const ReviewListSection: React.FC<ReviewListSectionProps> = ({
  targetUnitId,
  limit = 20,
}) => {
  const { t } = useTranslation(["common", "community"]);
  const readContext = useReadLanguageContext();
  const { data, isLoading, error } = useQuery({
    ...postQueries.byTarget(targetUnitId, {
      kind: PostKind.REVIEW,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      limit,
    }),
    enabled: readContext.ready && !!targetUnitId,
  });

  // Show spinner while loading or before query is enabled
  // 加载中或查询尚未启用时显示加载指示器
  if (isLoading || !readContext.ready) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }
  if (error) return <QueryErrorDisplay error={error} />;

  const reviews = data?.posts ?? [];
  if (reviews.length === 0) {
    return <EmptyState title={t("community:review_list_empty_title")} />;
  }

  return <ReviewList reviews={reviews} showTargetUnit={false} />;
};
