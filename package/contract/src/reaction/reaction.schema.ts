import { t } from "elysia";

export const allowedReactionKindSchema = t.Union([
  t.Literal("like"),
  t.Literal("dislike"),
]);
export type AllowedReactionKind = (typeof allowedReactionKindSchema)["static"];

export const knownReactionKindSchema = t.Union([
  t.Literal("like"),
  t.Literal("dislike"),
  t.Literal("heart"),
  t.Literal("funny"),
  t.Literal("award"),
]);
export type KnownReactionKind = (typeof knownReactionKindSchema)["static"];

export const createSchema = t.Object({
  targetId: t.String(),
  reaction: allowedReactionKindSchema,
});

export const deleteQuerySchema = t.Object({
  targetId: t.String(),
  reaction: allowedReactionKindSchema,
});

export const summaryQuerySchema = t.Object({
  targetIds: t.Optional(t.Union([t.String(), t.Array(t.String())])),
});

export const myQuerySchema = t.Object({
  targetIds: t.Optional(t.Union([t.String(), t.Array(t.String())])),
});

/** GET /reaction/given query parameters. */
export const givenQuerySchema = t.Object({
  userId: t.String(),
  reactions: t.Optional(t.String()),
  cursor: t.Optional(t.String()),
  limit: t.Optional(t.Numeric()),
});

const reactionRowSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  targetId: t.String(),
  reaction: t.String(),
  createdAt: t.String(),
});

export const givenResponseSchema = t.Object({
  items: t.Array(reactionRowSchema),
  nextCursor: t.Union([t.String(), t.Null()]),
});
export type GivenResponse = (typeof givenResponseSchema)["static"];
