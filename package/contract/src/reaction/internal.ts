import { t } from "elysia";
import { allowedReactionKindSchema } from "./reaction.schema";

export const cleanupBodySchema = t.Object({
  targetId: t.String(),
});

export const internalCreateBodySchema = t.Object({
  userId: t.String(),
  targetId: t.String(),
  reaction: allowedReactionKindSchema,
  scopeKey: t.String(),
});

export const internalCreateResponseSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  targetId: t.String(),
  reaction: allowedReactionKindSchema,
  scopeKey: t.String(),
  createdAt: t.String(),
  created: t.Boolean(),
});
export type InternalCreateResponse =
  (typeof internalCreateResponseSchema)["static"];

export const internalRemoveBodySchema = t.Object({
  userId: t.String(),
  targetId: t.String(),
  reaction: allowedReactionKindSchema,
  scopeKey: t.String(),
});

export const internalRemoveResponseSchema = t.Object({
  deleted: t.Boolean(),
});
export type InternalRemoveResponse =
  (typeof internalRemoveResponseSchema)["static"];

/** POST /internal/by-user request body. */
export const internalByUserBodySchema = t.Object({
  targetIds: t.Array(t.String()),
  reactions: t.Optional(t.Array(t.String())),
  scopeKey: t.Optional(t.String()),
  excludeUserId: t.Optional(t.String()),
  cursor: t.Optional(t.String()),
  limit: t.Optional(t.Number()),
});
export type InternalByUserBody = (typeof internalByUserBodySchema)["static"];

const internalReactionRowSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  targetId: t.String(),
  reaction: t.String(),
  scopeKey: t.String(),
  createdAt: t.String(),
});

export const internalByUserResponseSchema = t.Object({
  items: t.Array(internalReactionRowSchema),
  nextCursor: t.Union([t.String(), t.Null()]),
});
export type InternalByUserResponse =
  (typeof internalByUserResponseSchema)["static"];
