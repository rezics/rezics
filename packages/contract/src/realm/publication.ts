import { t } from "elysia";

export const moderationStatusValues = [
  "approved",
  "pending",
  "removed",
] as const;

export const moderationStatusSchema = t.Union([
  t.Literal("approved"),
  t.Literal("pending"),
  t.Literal("removed"),
]);

export type ModerationStatus = (typeof moderationStatusSchema)["static"];
