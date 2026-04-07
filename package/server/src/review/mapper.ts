import type {
  PublicUser,
  ReviewDTO,
  ReviewListQuery,
  UnitListQuery,
} from "@rezics/contract";
import type { Prisma, UnitType, User } from "#/prisma/client";
import type { ReviewWithRelations } from "./types";

/**
 * Sanitize user data for public response.
 *
 * 保留对外暴露所需的最小字段，避免泄露敏感信息。
 */
export function sanitizeUser(u: User): PublicUser {
  return {
    unitId: u.unitId,
    slug: u.slug,
    name: u.name,
    avatar: u.avatar ?? (null as any),
    bio: u.bio ?? undefined,
    description: u.description ?? undefined,
    followersCount: u.followersCount,
    followingsCount: u.followingsCount,
  };
}

/**
 * 从 unit.metadata 中解析出评分字段。
 *
 * - 若 `metadata.rating` 为 number，则返回其值
 * - 否则返回 `undefined`
 */
export function extractRatingFromMetadata(
  metadata: Prisma.JsonValue | null,
): number | undefined {
  if (
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    typeof (metadata as Record<string, unknown>).rating === "number"
  ) {
    return (metadata as Record<string, number>).rating;
  }
  return undefined;
}

/**
 * 生成带有 rating 的 metadata，保持原有 metadata 其他字段不变。
 */
export function buildMetadataWithRating(
  rating: number,
  baseMetadata?: Prisma.JsonValue | null,
): Record<string, unknown> {
  const base =
    baseMetadata &&
    typeof baseMetadata === "object" &&
    !Array.isArray(baseMetadata)
      ? { ...(baseMetadata as Record<string, unknown>) }
      : {};
  base.rating = rating;
  return base;
}

/**
 * 归一化评分值：只对有效 number 进行四舍五入，其余保持 `undefined`。
 */
export function normalizeRatingValue(value?: number): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return value;
}

/**
 * 将 Review 查询参数映射为 Unit 查询参数。
 *
 * - 负责处理 bookId / bookIds 合并
 * - 负责将排序字段从 review 语义映射为 unit 字段
 */
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
 * 根据查询条件构建评分相关的 where 子句。
 *
 * - 当同时存在 `ratingMin` / `ratingMax` 时使用 AND 组合
 * - 未提供任一评分条件时返回 `undefined`，避免多余过滤
 */
export function buildRatingWhereClause(
  options: ReviewListQuery,
): Prisma.UnitWhereInput | undefined {
  const clauses: Prisma.UnitWhereInput[] = [];
  if (typeof options.ratingMin === "number") {
    clauses.push({
      metadata: { path: ["rating"], gte: options.ratingMin } as any,
    });
  }
  if (typeof options.ratingMax === "number") {
    clauses.push({
      metadata: { path: ["rating"], lte: options.ratingMax } as any,
    });
  }
  return clauses.length > 0 ? { AND: clauses } : undefined;
}

/**
 * 将带关联的 Review Unit 转换为对外暴露的 DTO。
 */
export function mapReviewToDTO(unit: ReviewWithRelations): ReviewDTO {
  const meta = (unit.metadata ?? {}) as Record<string, unknown>;
  const rating =
    typeof meta.rating === "number" ? (meta.rating as number) : undefined;
  return {
    unitId: unit.id,
    bookId: unit.targetUnitId ?? "",
    title: unit.title ?? undefined,
    content: unit.content ?? "",
    rating,
    reactionSummaries: unit.reactionSummaries,
    created_at: unit.createdAt?.toISOString?.() ?? (unit.createdAt as any),
    user: unit.user ? sanitizeUser(unit.user) : undefined,
  };
}
