import { pgEnum } from "drizzle-orm/pg-core";

export const moderationCaseStateStorageValues = [
  "NEW",
  "TRIAGED",
  "ASSIGNED",
  "ACTIONED",
  "RESOLVED",
  "DUPLICATE",
  "REJECTED",
  "ESCALATED",
  "REVIEWING",
] as const;

export type ModerationCaseStateStorage =
  (typeof moderationCaseStateStorageValues)[number];

export const ModerationCaseState = pgEnum(
  "ModerationCaseState",
  moderationCaseStateStorageValues,
);

export const moderationStatusStorageValues = [
  "APPROVED",
  "PENDING",
  "REMOVED",
] as const;

export type ModerationStatusStorage =
  (typeof moderationStatusStorageValues)[number];

export const ModerationStatus = pgEnum(
  "ModerationStatus",
  moderationStatusStorageValues,
);

export const moderationScopeStorageValues = ["PLATFORM", "REALM"] as const;

export type ModerationScopeStorage =
  (typeof moderationScopeStorageValues)[number];

export const ModerationScope = pgEnum(
  "ModerationScope",
  moderationScopeStorageValues,
);

export const moderationTargetKindStorageValues = [
  "UNIT",
  "UNIT_REALM",
  "COMMENT",
  "UNIT_FIELD",
  "ACCOUNT",
  "REALM_MEMBER",
  "FEEDBACK",
] as const;

export type ModerationTargetKindStorage =
  (typeof moderationTargetKindStorageValues)[number];

export const ModerationTargetKind = pgEnum(
  "ModerationTargetKind",
  moderationTargetKindStorageValues,
);

export const moderationAuthorityStorageValues = [
  "PLATFORM",
  "REALM",
  "OWNER",
] as const;

export type ModerationAuthorityStorage =
  (typeof moderationAuthorityStorageValues)[number];

export const ModerationAuthority = pgEnum(
  "ModerationAuthority",
  moderationAuthorityStorageValues,
);

export const moderationActorKindStorageValues = [
  "USER",
  "SYSTEM",
  "AUTOMATION",
  "IMPORT",
] as const;

export type ModerationActorKindStorage =
  (typeof moderationActorKindStorageValues)[number];

export const ModerationActorKind = pgEnum(
  "ModerationActorKind",
  moderationActorKindStorageValues,
);

export const moderationActionKindStorageValues = [
  "APPROVE",
  "REMOVE",
  "RESTORE",
  "LOCK",
  "UNLOCK",
  "FIELD_LOCK",
  "FIELD_UNLOCK",
  "WARNING",
  "SILENCE",
  "SUSPENSION",
  "BAN",
  "RATE_LIMIT",
  "TRUST_RESTRICTION",
  "REVOKE_ENFORCEMENT",
  "MUTE_MEMBER",
  "REMOVE_MEMBER",
  "BAN_MEMBER",
  "RESTORE_MEMBER",
  "ESCALATE",
  "REVERSE",
  "NOTE",
] as const;

export type ModerationActionKindStorage =
  (typeof moderationActionKindStorageValues)[number];

export const ModerationActionKind = pgEnum(
  "ModerationActionKind",
  moderationActionKindStorageValues,
);
