import {
  aiDisclosureModeValues,
  catalogEntryKindValues,
  contentRatingValues,
  contentTranslationStatusValues,
  feedbackTypeValues,
  mainEmailVerificationContractStatusValues,
  pinKindValues,
  pollResultVisibilityValues,
  pollVoteModeValues,
  postKindValues,
  unitAliasKindValues,
  unitAliasStatusValues,
  unitStatusValues,
  unitVisibilityValues,
  userUnitProgressStatusValues,
} from "@rezics/contract";
import { pgEnum } from "drizzle-orm/pg-core";

export const unitTypeStorageValues = [
  "BOOK",
  "GAME",
  "MEDIA",
  "POST",
  "TAG",
  "REALM",
  "SHELF",
  "IMAGE",
  "VIDEO",
  "QUOTE",
  "LINK",
  "ENTITY",
  "ZONE",
  "USER",
  "SCOPE",
  "SERIES",
  "LABEL",
  "POLL",
  "COMMENT",
] as const;

export type UnitTypeStorage = (typeof unitTypeStorageValues)[number];

export const UnitType = pgEnum("UnitType", unitTypeStorageValues);

export const UnitStatus = pgEnum("UnitStatus", unitStatusValues);

export const UnitVisibility = pgEnum("UnitVisibility", unitVisibilityValues);

export const ContentRating = pgEnum("ContentRating", contentRatingValues);

export const UserUnitProgressStatus = pgEnum(
  "UserUnitProgressStatus",
  userUnitProgressStatusValues,
);

export const PostKind = pgEnum("PostKind", postKindValues);

export const EmailVerificationContractStatus = pgEnum(
  "EmailVerificationContractStatus",
  mainEmailVerificationContractStatusValues,
);

export const FeedbackType = pgEnum("FeedbackType", feedbackTypeValues);

export const UnitAliasKind = pgEnum("UnitAliasKind", unitAliasKindValues);

export const UnitAliasStatus = pgEnum("UnitAliasStatus", unitAliasStatusValues);

export const AiDisclosureMode = pgEnum(
  "AiDisclosureMode",
  aiDisclosureModeValues,
);

export const governanceGrantStateStorageValues = [
  "ACTIVE",
  "EXPIRED",
  "REVOKED",
] as const;

export type GovernanceGrantStateStorage =
  (typeof governanceGrantStateStorageValues)[number];

export const GovernanceGrantState = pgEnum(
  "GovernanceGrantState",
  governanceGrantStateStorageValues,
);

export const accountEnforcementKindStorageValues = [
  "WARNING",
  "SILENCE",
  "SUSPENSION",
  "BAN",
  "RATE_LIMIT",
  "TRUST_RESTRICTION",
] as const;

export type AccountEnforcementKindStorage =
  (typeof accountEnforcementKindStorageValues)[number];

export const AccountEnforcementKind = pgEnum(
  "AccountEnforcementKind",
  accountEnforcementKindStorageValues,
);

export const accountEnforcementStateStorageValues = [
  "ACTIVE",
  "EXPIRED",
  "REVOKED",
] as const;

export type AccountEnforcementStateStorage =
  (typeof accountEnforcementStateStorageValues)[number];

export const AccountEnforcementState = pgEnum(
  "AccountEnforcementState",
  accountEnforcementStateStorageValues,
);

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

export const realmMemberStateStorageValues = [
  "ACTIVE",
  "PENDING",
  "MUTED",
  "REMOVED",
  "BANNED",
] as const;

export type RealmMemberStateStorage =
  (typeof realmMemberStateStorageValues)[number];

export const RealmMemberState = pgEnum(
  "RealmMemberState",
  realmMemberStateStorageValues,
);

export const PinKind = pgEnum("PinKind", pinKindValues);

export const PollVoteMode = pgEnum("PollVoteMode", pollVoteModeValues);

export const PollResultVisibility = pgEnum(
  "PollResultVisibility",
  pollResultVisibilityValues,
);

export const CatalogEntryKind = pgEnum(
  "CatalogEntryKind",
  catalogEntryKindValues,
);

export const ContentTranslationStatus = pgEnum(
  "ContentTranslationStatus",
  contentTranslationStatusValues,
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
