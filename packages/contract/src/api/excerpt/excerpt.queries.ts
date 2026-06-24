/**
 * React Query configurations for excerpt queries
 */

import type { PostDTO, UnitDTO } from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { postApi } from "../post/post.api";
import { unitApi } from "../unit/unit.api";
import { excerptKeys } from "./excerpt.keys";

export const excerptDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: excerptKeys.detail(unitId),
    queryFn: () => getExcerptDetail(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 5,
  });

export const excerptQueries = {
  detail: excerptDetailQuery,
};

async function getExcerptDetail(unitId: string): Promise<UnitDTO> {
  try {
    const post = await postApi.get(unitId);
    return mapExcerptPostToUnit(post);
  } catch {
    return unitApi.get(unitId);
  }
}

function mapExcerptPostToUnit(post: PostDTO): UnitDTO {
  return {
    id: post.unitId,
    unitId: post.unitId,
    type: "QUOTE",
    userId: post.authorUserId,
    user: post.author,
    status: post.status,
    visibility: post.visibility,
    extra: post.extra ?? undefined,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    translations: [
      {
        unitId: post.unitId,
        language: "zh-hant",
        description: post.content ?? null,
      },
    ],
    replyCount: post.replyCount,
  } as UnitDTO;
}
