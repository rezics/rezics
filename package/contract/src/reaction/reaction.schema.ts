import { t } from "elysia";
import {
  DIRECT_REACTION_SCOPE_KEY,
  REALM_REACTION_SCOPE_PREFIX,
  type ReactionScopeKey,
} from "./reaction.scope";

/**
 * Development cutover: no `like`/`dislike` aliases are accepted. Existing rows
 * are migrated in place, and stale clients fail contract validation.
 * 开发期切换：不接受 `like`/`dislike` 别名。现有行会就地迁移，
 * 过时的客户端会因契约校验失败。
 */
export const allowedReactionKindSchema = t.Union([
  t.Literal("upvote"),
  t.Literal("downvote"),
]);
export type AllowedReactionKind = (typeof allowedReactionKindSchema)["static"];

export const knownReactionKindSchema = t.Union([
  t.Literal("upvote"),
  t.Literal("downvote"),
  t.Literal("heart"),
  t.Literal("funny"),
  t.Literal("award"),
]);
export type KnownReactionKind = (typeof knownReactionKindSchema)["static"];

export const createSchema = t.Object({
  targetId: t.String(),
  reaction: allowedReactionKindSchema,
  scopeKey: t.Optional(t.String()),
});

export const deleteQuerySchema = t.Object({
  targetId: t.String(),
  reaction: allowedReactionKindSchema,
  scopeKey: t.Optional(t.String()),
});

export const summaryQuerySchema = t.Object({
  targetIds: t.Optional(t.Union([t.String(), t.Array(t.String())])),
  scopeKey: t.Optional(t.String()),
});

export const myQuerySchema = t.Object({
  targetIds: t.Optional(t.Union([t.String(), t.Array(t.String())])),
  scopeKey: t.Optional(t.String()),
});

export const createShareSchema = t.Object({
  targetId: t.String(),
});
export type CreateShareInput = (typeof createShareSchema)["static"];

export const shareSummaryQuerySchema = t.Object({
  targetIds: t.Optional(t.Union([t.String(), t.Array(t.String())])),
});

export const shareSummaryResponseSchema = t.Object({
  summaries: t.Record(
    t.String(),
    t.Object({
      shareCount: t.Number(),
    }),
  ),
});
export type ShareSummaryResponse =
  (typeof shareSummaryResponseSchema)["static"];

export const createShareResponseSchema = t.Object({
  targetId: t.String(),
  shareCount: t.Number(),
  created: t.Boolean(),
});
export type CreateShareResponse = (typeof createShareResponseSchema)["static"];

/**
 * GET /reaction/given query parameters.
 * GET /reaction/given 的查询参数。
 */
export const givenQuerySchema = t.Object({
  userId: t.String(),
  reactions: t.Optional(t.String()),
  scopeKey: t.Optional(t.String()),
  cursor: t.Optional(t.String()),
  limit: t.Optional(t.Numeric()),
});

const reactionRowSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  targetId: t.String(),
  reaction: t.String(),
  scopeKey: t.String(),
  createdAt: t.String(),
});

export const givenResponseSchema = t.Object({
  items: t.Array(reactionRowSchema),
  nextCursor: t.Union([t.String(), t.Null()]),
});
export type GivenResponse = (typeof givenResponseSchema)["static"];

export function normalizeReactionScopeKey(
  scopeKey: string | null | undefined,
): ReactionScopeKey {
  const normalized = scopeKey?.trim();
  if (!normalized) return DIRECT_REACTION_SCOPE_KEY;
  if (normalized === DIRECT_REACTION_SCOPE_KEY)
    return DIRECT_REACTION_SCOPE_KEY;
  if (normalized.startsWith(REALM_REACTION_SCOPE_PREFIX)) {
    const realmUnitId = normalized.slice(REALM_REACTION_SCOPE_PREFIX.length);
    if (realmUnitId.length > 0) return normalized as ReactionScopeKey;
  }
  throw new Error(`Invalid reaction scope: ${normalized}`);
}
