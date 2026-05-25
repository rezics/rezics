import { postQueries } from "@rezics/api/post/post";
import { type PostDTO, PostKind, type UnitDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { ExcerptList } from "@/excerpt";
import { useMessage } from "@rezics/i18n/react";
import { common_loading } from "@rezics/i18n/messages";
const i18nMessages = {
  common_loading,
};

export type ExcerptPreviewProps = {
  id: string;
  excerptNumber?: number;
};

export const ExcerptPreview: React.FC<ExcerptPreviewProps> = ({
  id,
  excerptNumber = 3,
}) => {
  const m = useMessage(i18nMessages);
  const { data, isLoading, error } = useQuery(
    postQueries.byTarget(id, {
      kind: PostKind.EXCERPT,
      limit: excerptNumber,
    }),
  );

  if (isLoading) return <div>{m.common_loading()}</div>;
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
        description: post.content ?? null,
      },
    ],
    extra: post.extra,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  } as unknown as UnitDTO;
}
