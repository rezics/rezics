import { t } from "elysia";

export const cleanupBodySchema = t.Object({
  targetId: t.String(),
});

export const internalCreateBodySchema = t.Object({
  userId: t.String(),
  targetId: t.String(),
  reaction: t.String(),
});

export const internalCreateResponseSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  targetId: t.String(),
  reaction: t.String(),
  createdAt: t.String(),
  created: t.Boolean(),
});
export type InternalCreateResponse =
  (typeof internalCreateResponseSchema)["static"];

export const internalRemoveBodySchema = t.Object({
  userId: t.String(),
  targetId: t.String(),
  reaction: t.String(),
});

export const internalRemoveResponseSchema = t.Object({
  deleted: t.Boolean(),
});
export type InternalRemoveResponse =
  (typeof internalRemoveResponseSchema)["static"];
