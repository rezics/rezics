import { t } from "elysia";

export const systemEmailKindSchema = t.String();
export type SystemEmailKind = (typeof systemEmailKindSchema)["static"];

export const systemEmailBodySchema = t.Object({
  userId: t.String(),
  kind: systemEmailKindSchema,
  payload: t.Any(),
  locale: t.Optional(t.String()),
});
export type SystemEmailBody = (typeof systemEmailBodySchema)["static"];

export const systemEmailResponseSchema = t.Object({
  success: t.Boolean(),
  notificationId: t.Optional(t.String()),
  deduplicated: t.Optional(t.Boolean()),
});
export type SystemEmailResponse = (typeof systemEmailResponseSchema)["static"];
