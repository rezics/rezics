import { t } from "elysia";

export const cleanupBodySchema = t.Object({
  targetId: t.String(),
});

export const ownerResponseSchema = t.Object({
  ownerId: t.String(),
});
