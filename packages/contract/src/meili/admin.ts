import { t } from "elysia";

export const meiliHealthResponseSchema = t.Object({
  status: t.String(),
});

export type MeiliHealthResponse =
  (typeof meiliHealthResponseSchema)["static"];

export const meiliApiMessageResponseSchema = t.Object({
  message: t.String(),
});

export type MeiliApiMessageResponse =
  (typeof meiliApiMessageResponseSchema)["static"];

export const meiliTaskResponseSchema = t.Object({
  task: t.Unknown(),
});

export type MeiliTaskResponse = (typeof meiliTaskResponseSchema)["static"];

export const meiliKeySchema = t.Object(
  {
    uid: t.Optional(t.String()),
    key: t.Optional(t.String()),
    name: t.Optional(t.Nullable(t.String())),
    description: t.Optional(t.Nullable(t.String())),
    actions: t.Optional(t.Array(t.String())),
    indexes: t.Optional(t.Array(t.String())),
    expiresAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
    createdAt: t.Optional(t.Union([t.String(), t.Date()])),
    updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
  },
  { additionalProperties: true },
);

export type MeiliKey = (typeof meiliKeySchema)["static"];

export const meiliKeyListResponseSchema = t.Object({
  results: t.Array(meiliKeySchema),
  limit: t.Number(),
  offset: t.Number(),
  total: t.Number(),
});

export type MeiliKeyListResponse =
  (typeof meiliKeyListResponseSchema)["static"];
