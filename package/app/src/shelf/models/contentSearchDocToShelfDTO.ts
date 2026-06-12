/**
 * Maps a ContentSearchDocument (from Meilisearch content index) to ShelfDTO shape.
 * 将 ContentSearchDocument（来自 Meilisearch 内容索引）映射为 ShelfDTO 形状。
 *
 * ContentSearchDocument uses `id` as primary key and stores translations in a
 * different schema than UnitTranslationDTO. ShelfDTO expects `unitId`, typed
 * translations with `unitId` on each row, and shelf-specific fields like
 * `coverUrl`, `visibility`, and `userId`. This mapper bridges the gap so
 * downstream components (ShelfCard, HorizontalShelfCarousel) receive the shape
 * they declare.
 * ContentSearchDocument 使用 `id` 作为主键，其翻译的 schema 与 UnitTranslationDTO
 * 不同。ShelfDTO 期望 `unitId`、每行翻译带 `unitId` 的类型化翻译，以及
 * `coverUrl`、`visibility`、`userId` 等书架专用字段。本映射器弥合了这一差距，
 * 使下游组件（ShelfCard、HorizontalShelfCarousel）收到它们声明的形状。
 */

import type { ContentSearchDocument, ShelfDTO } from "@rezics/contract";
import { DEFAULT_LANGUAGE } from "@rezics/contract";

export function mapContentSearchDocToShelfDTO(
  doc: ContentSearchDocument,
): ShelfDTO {
  // Build UnitTranslationDTO-compatible translations from search document.
  // 从搜索文档构建 UnitTranslationDTO 兼容的翻译。
  const translations =
    doc.translations?.map((tr) => ({
      unitId: doc.id,
      language: tr.language,
      title: tr.title,
      subtitle: tr.subtitle,
      summary: tr.summary,
      description: tr.description,
    })) ??
    (doc.titles[0]
      ? [
          {
            unitId: doc.id,
            language: doc.defaultLanguage ?? DEFAULT_LANGUAGE,
            title: doc.titles[0],
            subtitle: doc.subtitles?.[0] ?? null,
            summary: doc.summaries[0] ?? null,
            description: null,
          },
        ]
      : []);

  return {
    unitId: doc.id,
    userId: doc.userId,
    coverUrl: doc.coverUrl,
    visibility: doc.visibility,
    translations,
  };
}
