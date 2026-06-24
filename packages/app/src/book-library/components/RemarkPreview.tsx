import { postQueries } from "@rezics/contract/api/post/post";
import { PostKind } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core";
import { RemarkList } from "@/remark";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

interface ShortBookReviewsProps {
  bookId: string;
}

export const RemarkPreview: React.FC<ShortBookReviewsProps> = ({ bookId }) => {
  const readContext = useReadLanguageContext();
  const { data, isLoading, error } = useQuery({
    ...postQueries.byTarget(bookId, {
      kind: PostKind.REMARK,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      limit: 4,
    }),
    enabled: readContext.ready && !!bookId,
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
  if (error) {
    return <QueryErrorDisplay error={error} />;
  }

  const posts = data?.posts?.slice(0, 4) ?? [];
  return <RemarkList posts={posts} />;
};
