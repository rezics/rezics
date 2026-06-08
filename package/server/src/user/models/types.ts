// Type only used in server, otherwise use contract
// 仅服务端使用的类型，否则请使用 contract。

import { t } from "elysia";
import type { Unit, User } from "../../db/schema";

/**
 * Internal user type with relations and the canonical slug attached
 * separately.
 * 内部 user 类型，关联数据与规范 slug 单独附加。
 *
 * The User row does not carry the slug column directly — slug now lives on
 * the USER `Unit`. Services that load Users attach `slug` as part of the
 * read path so DTO mappers can read it without re-querying.
 * User 行不直接携带 slug 列——slug 现存于 USER `Unit` 上。加载 User 的服务
 * 在读取路径中附加 `slug`，以便 DTO mapper 无需重新查询即可读取。
 */
export type UserWithRelations = typeof User.$inferSelect & {
  units?: (typeof Unit.$inferSelect)[];
  /** Canonical slug copied from the matching USER `Unit.slug`. 从匹配的 USER `Unit.slug` 复制的规范 slug。 */
  slug?: string | null;
};

/**
 * Query filter types
 * 查询过滤器类型。
 */
export type UserFilterOptions = {
  q?: string; // search in name or slug — 在 name 或 slug 中搜索
  slug?: string;
  page?: number;
  limit?: number;
};

/** User relation hydration shape used by services that attach Unit rows. 附加 Unit 行的服务所用的 User 关联填充结构。 */
export const userInclude = {
  units: {
    take: 10,
    orderBy: { createdAt: "desc" },
  },
};

/**
 * JWT Payload type
 * JWT 载荷类型。
 */
export const jwtPayloadSchema = t.Object({
  userId: t.String(),
  slug: t.Optional(t.String()),
  scope: t.Union([t.String(), t.Array(t.String())]),
  permission: t.Optional(
    t.Object(
      {
        role: t.Array(t.String()),
      },
      { additionalProperties: true },
    ),
  ),
});

export type JWTPayload = (typeof jwtPayloadSchema)["static"];
