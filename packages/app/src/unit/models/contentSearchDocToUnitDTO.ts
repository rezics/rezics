/**
 * Maps a ContentSearchDocument (from Meilisearch content index) to UnitDTO shape.
 * 将 ContentSearchDocument（来自 Meilisearch 内容索引）映射为 UnitDTO 形状。
 *
 * ContentSearchDocument carries many indexing-specific arrays (titles, summaries,
 * etc.) but overlaps structurally with UnitDTO on `id`, `type`, `title`,
 * `description`, `translations`, and most sortable/filterable metadata. This
 * mapper extracts the UnitDTO-compatible subset so downstream renderers
 * (defaultChildren in UnitsPage, ExcerptList / ExcerptCard) receive the shape
 * they declare without an unsafe double cast.
 * ContentSearchDocument 携带许多索引专用数组（titles、summaries 等），但在 `id`、
 * `type`、`title`、`description`、`translations` 及多数可排序/可过滤元数据上
 * 与 UnitDTO 结构重叠。本映射器提取 UnitDTO 兼容的子集，使下游渲染器
 * （UnitsPage 的 defaultChildren、ExcerptList / ExcerptCard）收到它们声明的
 * 形状，无需不安全的双重断言。
 */

import type { ContentSearchDocument, UnitDTO } from "@rezics/contract";

export function mapContentSearchDocToUnitDTO(
  doc: ContentSearchDocument,
): UnitDTO {
  // Build UnitTranslationDTO-compatible translations from search document.
  // 从搜索文档构建 UnitTranslationDTO 兼容的翻译。
  const translations = doc.translations?.map((tr) => ({
    unitId: doc.id,
    language: tr.language,
    title: tr.title,
    subtitle: tr.subtitle,
    summary: tr.summary,
    description: tr.description,
  }));

  return {
    id: doc.id,
    type: doc.type,
    slug: undefined,
    userId: doc.userId,
    visibility: doc.visibility,
    rating: doc.rating,
    aiDisclosureMode: doc.aiDisclosureMode,
    catalogEntryKind: doc.catalogEntryKind,
    targetUnitId: doc.targetUnitId,
    isLanguageNeutral: doc.isLanguageNeutral,
    resolvedLanguage: doc.resolvedLanguage,
    title: doc.title,
    subtitle: doc.subtitle,
    summary: doc.summary,
    description: doc.description,
    translations,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    publishedAt: doc.publishedAt,
    referenceCount: doc.referenceCount,
    shareCount: doc.shareCount,
  };
}
