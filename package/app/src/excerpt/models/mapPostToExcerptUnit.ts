import type { PostDTO, UnitDTO } from "@rezics/contract";

/**
 * Map a PostDTO (from shelf hydration or post search) to the UnitDTO shape
 * that ExcerptCard / ExcerptDetail expect.
 * 将 PostDTO（来自书架水合或帖子搜索）映射为 ExcerptCard / ExcerptDetail 所需的
 * UnitDTO 结构。
 */
export function mapPostToExcerptUnit(post: PostDTO): UnitDTO {
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
