import { pgEnum } from "drizzle-orm/pg-core";
export const UnitType = pgEnum("UnitType", [
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
]);

export const UnitStatus = pgEnum("UnitStatus", [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
  "DELETED",
]);

export const UnitVisibility = pgEnum("UnitVisibility", [
  "PUBLIC",
  "UNLISTED",
  "PRIVATE",
]);

export const ContentRating = pgEnum("ContentRating", [
  "GENERAL",
  "R_15",
  "R_18",
  "R_18G",
]);

export const UserUnitProgressStatus = pgEnum("UserUnitProgressStatus", [
  "BACKLOG",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "DROPPED",
]);

export const PostKind = pgEnum("PostKind", [
  "REVIEW",
  "EXCERPT",
  "REMARK",
  "POST",
  "CHAPTER",
  "WIKI",
]);

export const EmailVerificationContractStatus = pgEnum(
  "EmailVerificationContractStatus",
  ["PENDING", "VERIFIED", "EXPIRED"],
);

export const FeedbackType = pgEnum("FeedbackType", [
  "REPORT",
  "BUG",
  "FEATURE",
  "OTHER",
]);

export const UnitAliasKind = pgEnum("UnitAliasKind", [
  "COMMON",
  "ABBREVIATION",
  "TRANSLITERATION",
  "ALTERNATE_TITLE",
  "LEGACY_TITLE",
  "MISSPELLING",
  "OTHER",
]);

export const UnitAliasStatus = pgEnum("UnitAliasStatus", ["ACTIVE", "HIDDEN"]);

export const AiDisclosureMode = pgEnum("AiDisclosureMode", [
  "UNKNOWN",
  "NONE",
  "AI_ASSISTED",
  "AI_ORIGINATED",
  "MACHINE_GENERATED",
]);

export const GovernanceGrantState = pgEnum("GovernanceGrantState", [
  "ACTIVE",
  "EXPIRED",
  "REVOKED",
]);

export const AccountEnforcementKind = pgEnum("AccountEnforcementKind", [
  "WARNING",
  "SILENCE",
  "SUSPENSION",
  "BAN",
  "RATE_LIMIT",
  "TRUST_RESTRICTION",
]);

export const AccountEnforcementState = pgEnum("AccountEnforcementState", [
  "ACTIVE",
  "EXPIRED",
  "REVOKED",
]);

export const ModerationCaseState = pgEnum("ModerationCaseState", [
  "NEW",
  "TRIAGED",
  "ASSIGNED",
  "ACTIONED",
  "RESOLVED",
  "DUPLICATE",
  "REJECTED",
  "ESCALATED",
  "REVIEWING",
]);

export const RealmMemberState = pgEnum("RealmMemberState", [
  "ACTIVE",
  "PENDING",
  "MUTED",
  "REMOVED",
  "BANNED",
]);

export const PinKind = pgEnum("PinKind", [
  "ACCEPTED_ANSWER",
  "PINNED",
  "HIGHLIGHT",
]);

export const PollVoteMode = pgEnum("PollVoteMode", ["SINGLE", "MULTI"]);

export const PollResultVisibility = pgEnum("PollResultVisibility", [
  "LIVE",
  "AFTER_CLOSE",
]);

export const CatalogEntryKind = pgEnum("CatalogEntryKind", [
  "MAIN",
  "VARIANT",
  "NONE",
]);

export const ContentTranslationStatus = pgEnum("ContentTranslationStatus", [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);

export const ModerationStatus = pgEnum("ModerationStatus", [
  "APPROVED",
  "PENDING",
  "REMOVED",
]);

export const ModerationScope = pgEnum("ModerationScope", ["PLATFORM", "REALM"]);

export const ModerationTargetKind = pgEnum("ModerationTargetKind", [
  "UNIT",
  "UNIT_REALM",
  "COMMENT",
  "UNIT_FIELD",
  "ACCOUNT",
  "REALM_MEMBER",
  "FEEDBACK",
]);

export const ModerationAuthority = pgEnum("ModerationAuthority", [
  "PLATFORM",
  "REALM",
  "OWNER",
]);

export const ModerationActorKind = pgEnum("ModerationActorKind", [
  "USER",
  "SYSTEM",
  "AUTOMATION",
  "IMPORT",
]);

export const ModerationActionKind = pgEnum("ModerationActionKind", [
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
]);
