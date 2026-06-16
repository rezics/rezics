import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core";
import { RemarkList } from "@/remark";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

interface ShortBookReviewsProps {
  bookId: string;
}

export const RemarkPreview: React.FC<ShortBookReviewsProps> = ({ bookId }) => {
  const { t } = useTranslation(["common"]);
  const readContext = useReadLanguageContext();
  const { data, isLoading, error } = useQuery({
    ...postQueries.byTarget(bookId, {
      kind: PostKind.REMARK,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      languageMode: readContext.languageMode,
      limit: 4,
    }),
    enabled: readContext.ready && !!bookId,
  });

  if (isLoading) {
    return <div>{t("common:loading")}</div>;
  }
  if (error) {
    return <QueryErrorDisplay error={error} />;
  }

  const posts = data?.posts?.slice(0, 4) ?? [];
  return <RemarkList posts={posts} />;
};
