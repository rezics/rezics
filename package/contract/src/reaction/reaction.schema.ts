import { t } from "elysia";

export const createSchema = t.Object({
  targetId: t.String(),
  reaction: t.String(),
});

export const deleteQuerySchema = t.Object({
  targetId: t.String(),
  reaction: t.String(),
});

export const summaryQuerySchema = t.Object({
  targetIds: t.Optional(t.Union([t.String(), t.Array(t.String())])),
});

export const myQuerySchema = t.Object({
  targetIds: t.Optional(t.Union([t.String(), t.Array(t.String())])),
});
