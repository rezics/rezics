import { postQueries } from "@rezics/api/post/post";
import { type PostDTO, PostKind, type UnitDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { ExcerptList } from "@/excerpt";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

export type ExcerptPreviewProps = {
  id: string;
  excerptNumber?: number;
};

export const ExcerptPreview: React.FC<ExcerptPreviewProps> = ({
  id,
  excerptNumber = 3,
}) => {
  const { t } = useTranslation(["common"]);
  const readContext = useReadLanguageContext();
  const { data, isLoading, error } = useQuery({
    ...postQueries.byTarget(id, {
      kind: PostKind.EXCERPT,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      languageMode: readContext.languageMode,
      limit: excerptNumber,
    }),
    enabled: readContext.ready && Boolean(id),
  });

  if (isLoading) return <div>{t("common:loading")}</div>;
  if (error) return <QueryErrorDisplay error={error} />;

  const units: UnitDTO[] =
    data?.posts?.slice(0, excerptNumber).map(mapExcerptPostToUnit) ?? [];
  return <ExcerptList units={units} />;
};

export { ExcerptPreview as ExcerptPreviewContainer };

function mapExcerptPostToUnit(post: PostDTO): UnitDTO {
  return {
    id: post.unitId,
    unitId: post.unitId,
    type: "QUOTE",
    user: post.author,
    translations: [
      {
        unitId: post.unitId,
        language: post.resolvedLanguage ?? "en",
        title: null,
        subtitle: null,
        summary: null,
        description: post.content ?? null,
      },
    ],
    extra: post.extra,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  } as unknown as UnitDTO;
}
