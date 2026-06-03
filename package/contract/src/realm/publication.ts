import { t } from "elysia";

export const realmFeedPublicationStateValues = [
  "pending_review",
  "approved",
  "rejected",
  "removed",
] as const;

export const realmFeedPublicationStateSchema = t.Union([
  t.Literal("pending_review"),
  t.Literal("approved"),
  t.Literal("rejected"),
  t.Literal("removed"),
]);

export type RealmFeedPublicationState =
  (typeof realmFeedPublicationStateSchema)["static"];
