import { postQueries } from "@rezics/contract/api/post/post";
import { PostKind, type UnitDTO } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core";
import { ExcerptList, mapPostToExcerptUnit } from "@/excerpt";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

export type ExcerptPreviewProps = {
  id: string;
  excerptNumber?: number;
};

export const ExcerptPreview: React.FC<ExcerptPreviewProps> = ({
  id,
  excerptNumber = 3,
}) => {
  const readContext = useReadLanguageContext();
  const { data, isLoading, error } = useQuery({
    ...postQueries.byTarget(id, {
      kind: PostKind.EXCERPT,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      limit: excerptNumber,
    }),
    enabled: readContext.ready && Boolean(id),
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

  const units: UnitDTO[] =
    data?.posts?.slice(0, excerptNumber).map(mapPostToExcerptUnit) ?? [];
  return <ExcerptList units={units} />;
};

export { ExcerptPreview as ExcerptPreviewContainer };
