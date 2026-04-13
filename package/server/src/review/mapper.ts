import type { ReviewDTO, ReviewListQuery, UnitListQuery } from "@rezics/contract";
import type { UnitType } from "#/prisma/client";
import { sanitizeUserWithBio } from "@/utils/sanitizeUser";
import type { ReviewWithRelations } from "./types";

export function mapReviewQueryToUnitQuery(
  options: ReviewListQuery,
  unitType: UnitType,
): UnitListQuery {
  const unitQuery: UnitListQuery = {
    q: options.q,
    userId: options.userId,
    tag: options.tag,
    tags: options.tags,
    start: options.start,
    limit: options.limit,
    sort: options.sort
      ? {
          field: mapSortField(options.sort.type),
          order: options.sort.order,
        }
      : undefined,
    cursor: options.cursor?.id
      ? { unitId: options.cursor.id, createdAt: options.cursor.createdAt }
      : undefined,
    type: unitType,
  };

  const targetIds = new Set<string>();
  if (options.bookId?.trim()) targetIds.add(options.bookId.trim());
  if (options.bookIds) {
    options.bookIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((id) => {
        targetIds.add(id);
      });
  }

  if (targetIds.size === 1) {
    unitQuery.targetUnitId = [...targetIds][0];
  } else if (targetIds.size > 1) {
    unitQuery.targetUnitIds = Array.from(targetIds).join(",");
  }

  return unitQuery;
}

/**
 * 将排序类型映射为 Unit 支持的排序字段。
 *
 * - 默认按 `createdAt` 排序
 * - 当 sortType 为 `updatedAt` 时，按 `updatedAt` 排序
 */
export function mapSortField(sortType?: string): "createdAt" | "updatedAt" {
  if (sortType === "updatedAt") return "updatedAt";
  return "createdAt";
}

/**
 * 将带关联的 Review Unit 转换为对外暴露的 DTO。
 */
export function mapReviewToDTO(unit: ReviewWithRelations): ReviewDTO {
  return {
    unitId: unit.id,
    bookId: unit.targetUnitId ?? "",
    title: unit.title ?? undefined,
    content: unit.content ?? "",
    created_at: unit.createdAt?.toISOString?.() ?? (unit.createdAt as any),
    user: unit.user ? sanitizeUserWithBio(unit.user) : undefined,
  };
}
