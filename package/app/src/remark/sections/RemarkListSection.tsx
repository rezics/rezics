import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { useReadLanguageCandidates } from "@/shared/hooks/useReadLanguageCandidates";
import { RemarkList } from "../components/list/RemarkList";

interface RemarkListSectionProps {
  targetUnitId: string;
  limit?: number;
}

export const RemarkListSection: React.FC<RemarkListSectionProps> = ({
  targetUnitId,
  limit = 20,
}) => {
  const { t } = useTranslation(["common"]);
  const languages = useReadLanguageCandidates();
  const { data, isLoading, error } = useQuery({
    ...postQueries.list({
      targetUnitId,
      kind: PostKind.REMARK,
      languages,
      limit,
    }),
    enabled: !!targetUnitId,
  });

  if (isLoading) return <div>{t("common:loading")}</div>;
  if (error) return <QueryErrorDisplay error={error} />;

  const posts = data?.posts ?? [];
  return <RemarkList posts={posts} />;
};
