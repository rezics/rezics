import { t } from "elysia";

export const unitRealmModerationStateValues = [
  "pending_review",
  "approved",
  "rejected",
  "removed",
] as const;

export const unitRealmModerationStateSchema = t.Union([
  t.Literal("pending_review"),
  t.Literal("approved"),
  t.Literal("rejected"),
  t.Literal("removed"),
]);

export type UnitRealmModerationState =
  (typeof unitRealmModerationStateSchema)["static"];

export const unitRealmVisibilityStateValues = [
  "visible",
  "hidden",
  "tombstoned",
] as const;

export const unitRealmVisibilityStateSchema = t.Union([
  t.Literal("visible"),
  t.Literal("hidden"),
  t.Literal("tombstoned"),
]);

export type UnitRealmVisibilityState =
  (typeof unitRealmVisibilityStateSchema)["static"];
