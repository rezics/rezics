import { postQueries } from "@rezics/api/post/post";
import { type PostDTO, PostKind, type UnitDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { ExcerptList } from "@/excerpt";

export type ExcerptPreviewProps = {
  id: string;
  excerptNumber?: number;
};

export const ExcerptPreview: React.FC<ExcerptPreviewProps> = ({
  id,
  excerptNumber = 3,
}) => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery(
    postQueries.byTarget(id, {
      kind: PostKind.EXCERPT,
      limit: excerptNumber,
    }),
  );

  if (isLoading) return <div>{t("common.loading")}</div>;
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
        language: "zh-hant",
        title: null,
        subtitle: null,
        summary: null,
        description: post.body,
      },
    ],
    extra: post.extra,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  } as unknown as UnitDTO;
}
