import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { RemarkList } from "../components/list/RemarkList";

interface RemarkListSectionProps {
  targetUnitId: string;
  limit?: number;
}

/**
 * Remark (post) list section.
 *
 * Queries and displays all remarks targeting a specific unit.
 * Respects user's language preferences. Handles loading/error states.
 *
 * 备注列表区域，查询并显示针对特定 Unit 的所有备注。
 * 尊重用户的语言偏好设置。处理加载和错误状态。
 *
 * Desktop (1200px):
 * +---------------------------------------------+
 * | Remarks on This Book (12)                   |
 * +---------------------------------------------+
 * | [Remark 1] - Author 1 | 2 days ago          |
 * | Short preview text...                       |
 * |                                             |
 * | [Remark 2] - Author 2 | 5 days ago          |
 * | Short preview text...                       |
 * +---------------------------------------------+
 *
 * Tablet (768px):
 * +----------------------------------+
 * | Remarks (12)                     |
 * +----------------------------------+
 * | [Remark 1]                       |
 * | Author 1 | 2 days ago            |
 * | Preview...                       |
 * |                                  |
 * | [Remark 2]                       |
 * | Author 2 | 5 days ago            |
 * +----------------------------------+
 *
 * Mobile (360px):
 * +----------+
 * | Remarks  |
 * +----------+
 * | Title 1  |
 * | Author 1 |
 * |          |
 * | Title 2  |
 * | Author 2 |
 * +----------+
 *
 * Error State:
 * +----------+
 * | Error    |
 * | Try again|
 * +----------+
 */
export const RemarkListSection: React.FC<RemarkListSectionProps> = ({
  targetUnitId,
  limit = 20,
}) => {
  const readContext = useReadLanguageContext();
  const { data, isLoading, error } = useQuery({
    ...postQueries.list({
      targetUnitId,
      kind: PostKind.REMARK,
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

  const posts = data?.posts ?? [];
  return <RemarkList posts={posts} />;
};
