import type { Static } from "elysia";
import { t } from "elysia";
import { contentDocSchema } from "../content/doc-v1";

// ANCHOR: User Search Document
// ANCHOR: 用户搜索文档
// UserType removed — no more AUTHOR/PRESS/PRODUCER distinction.
// UserType 已移除——不再区分 AUTHOR/PRESS/PRODUCER。

export const UserSearchDocumentSchema = t.Object({
  id: t.String(),
  /**
   * Canonical user identifier — the USER `Unit.id`. Equals `id` post-`user-namespace-slug`.
   * 规范的用户标识符——即 USER 的 `Unit.id`。在 `user-namespace-slug` 之后等于 `id`。
   */
  unitId: t.String(),
  name: t.String(),
  email: t.Optional(t.String()),
  slug: t.Optional(t.Union([t.String(), t.Null()])),
  avatar: t.Optional(t.Union([t.String(), t.Null()])),
  summary: t.Optional(t.Union([t.String(), t.Null()])),
  description: t.Optional(t.Union([contentDocSchema, t.Null()])),
  descriptionText: t.Optional(t.Union([t.String(), t.Null()])),
  followersCount: t.Optional(t.Union([t.Number(), t.Null()])),
  followingsCount: t.Optional(t.Union([t.Number(), t.Null()])),
  joinDate: t.Optional(t.Union([t.String(), t.Null()])),
  permission: t.Optional(
    t.Object(
      {
        role: t.Array(t.String()),
      },
      { additionalProperties: true },
    ),
  ),
});

export type UserSearchDocument = Static<typeof UserSearchDocumentSchema>;

export interface UserSearchResult {
  users: UserSearchDocument[];
  total: number;
  processingTimeMs: number;
  query: string;
}
