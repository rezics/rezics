export {
	ContentLanguageValues,
	DefaultContentLanguage,
	DefaultStoredUiLocale,
	StoredUiLocaleValues,
} from "@rezics/i18n";
export type { ContentLanguage, StoredUiLocale } from "@rezics/i18n";

export const UnitKindValues = [
	"slug_namespace",
	"profile",
	"book",
	"software",
	"media",
	"release",
	"entity",
	"tag",
	"series",
	"zone",
	"collection",
	"post",
	"poll",
	"realm",
	"realm_rule",
] as const;
export const CommunityCatalogUnitKindValues = [
	"book",
	"software",
	"media",
	"series",
	"entity",
	"tag",
] as const;

export const VariantCapableUnitKindValues = ["book", "software", "media"] as const;

export type UnitKind = (typeof UnitKindValues)[number];
export type VariantCapableUnitKind = (typeof VariantCapableUnitKindValues)[number];

export const DockSurfaceValues = ["main", "wiki"] as const;
export type DockSurface = (typeof DockSurfaceValues)[number];
export const DockOwnerUnitKindValues = ["book", "software", "media", "zone", "realm"] as const;
export type DockOwnerUnitKind = (typeof DockOwnerUnitKindValues)[number];
export const DockSurfacesByUnitKind = {
	book: ["main"],
	software: ["main"],
	media: ["main"],
	zone: ["main"],
	realm: ["main", "wiki"],
} as const satisfies Record<DockOwnerUnitKind, readonly DockSurface[]>;

export function isDockOwnerUnitKind(kind: UnitKind): kind is DockOwnerUnitKind {
	return (DockOwnerUnitKindValues as readonly UnitKind[]).includes(kind);
}

export function isDockSurfaceSupported(kind: UnitKind, surface: DockSurface): boolean {
	return isDockOwnerUnitKind(kind)
		? (DockSurfacesByUnitKind[kind] as readonly DockSurface[]).includes(surface)
		: false;
}

export const SlugAddressKindValues = ["canonical", "redirect"] as const;
export type SlugAddressKind = (typeof SlugAddressKindValues)[number];

export const UnitStatusValues = ["draft", "published", "archived"] as const;
export const UnitStatusActorKindValues = ["profile", "system", "import"] as const;
export const UnitVisibilityValues = ["public", "unlisted", "private"] as const;
export const ContentRatingValues = ["general", "r15", "r18", "r18g"] as const;
export const AiDisclosureValues = [
	"unknown",
	"none",
	"ai_assisted",
	"ai_originated",
	"machine_generated",
] as const;
export const ModerationStatusValues = ["approved", "pending", "removed"] as const;
export const ContentStatusValues = ["draft", "published", "archived"] as const;
export const ImageAssetStatusValues = ["pending", "ready", "failed"] as const;
export const ImageAssetAccessValues = ["private", "public"] as const;
export const PostKindValues = [
	"post",
	"reply",
	"review",
	"chapter",
	"chapter_group",
	"wiki",
	"picture",
	"governance_note",
] as const;
export const ProgressStatusValues = [
	"backlog",
	"active",
	"paused",
	"completed",
	"dropped",
] as const;
export const NotificationKindValues = [
	"reply",
	"new_follower",
	"direct_message",
	"moderation",
	"realm",
	"system",
] as const;
export const FeedbackKindValues = ["report", "bug", "feature", "other"] as const;
export const EnforcementKindValues = [
	"warning",
	"silence",
	"suspension",
	"ban",
	"rate_limit",
	"trust_restriction",
] as const;
export const CapabilityAuthorityValues = ["platform", "realm"] as const;
export const UnitAccessSubjectKindValues = ["profile", "realm", "authenticated"] as const;
export const UnitAccessRestrictionSubjectKindValues = ["profile", "realm"] as const;
export const UnitAccessRealmRelationValues = ["member", "content_editor", "governor"] as const;
export const UnitAccessInvitationResolutionValues = ["accepted", "declined", "cancelled"] as const;
export const UnitAccessRoleValues = [
	"viewer",
	"editor",
	"publishing_editor",
	"maintainer",
	"owner",
] as const;
export const UnitDelegableAccessRoleValues = [
	"viewer",
	"editor",
	"publishing_editor",
	"maintainer",
] as const;
export const UnitPermissionValues = [
	"unit.read",
	"unit.update",
	"unit.publish",
	"unit.history.restore",
	"unit.access.manage",
	"unit.association.manage",
	"unit.protection.manage",
	"unit.delete",
] as const;
export const UnitProtectionModeValues = ["frozen", "owner_only"] as const;
export const RealmJoinPolicyValues = ["open", "approval"] as const;
export const RealmMemberRoleValues = ["owner", "admin", "moderator", "member"] as const;
export const RealmMemberStateValues = ["active", "pending", "muted", "removed", "banned"] as const;
export const RealmPinKindValues = ["pinned", "highlight"] as const;
export const RealmUnitStatusValues = ["pending", "visible", "hidden", "removed"] as const;
export const RealmUnitMutationCommandValues = [
	"approve",
	"hide",
	"remove",
	"restore",
	"lock_post_targeting",
	"unlock_post_targeting",
] as const;
export const RealmModerationCommandValues = [...RealmUnitMutationCommandValues, "note"] as const;
export const GovernanceReasonCodeValues = [
	"content_policy",
	"realm_rules",
	"spam",
	"harassment",
	"unsafe_content",
	"off_topic",
	"duplicate",
	"account_security",
	"user_request",
	"appeal",
	"administrative",
	"other",
] as const;
export const GovernanceNoteRoleValues = ["evidence", "internal_note", "public_notice"] as const;
export const GovernanceNoteSubjectKindValues = [
	"feedback",
	"moderation_case",
	"moderation_action",
	"unit_access_restriction",
	"unit_protection",
	"realm_unit_status_event",
] as const;
export const ModerationTargetKindValues = [
	"unit",
	"unit_field",
	"profile",
	"realm_unit",
	"realm_member",
	"feedback",
] as const;
export const ModerationActionKindValues = [
	"approve",
	"hide",
	"remove",
	"restore",
	"lock_post_targeting",
	"unlock_post_targeting",
	"protect",
	"unprotect",
	...EnforcementKindValues,
	"revoke_enforcement",
	"mute_member",
	"remove_member",
	"ban_member",
	"restore_member",
	"escalate",
	"reverse",
	"note",
] as const;
export const AliasKindValues = [
	"common",
	"abbreviation",
	"transliteration",
	"alternate_title",
	"legacy_title",
	"misspelling",
	"other",
] as const;
export const AliasSearchScoreThreshold = 3;
export const PollModeValues = ["single", "multiple"] as const;
export const PollOptionSourceKindValues = ["literal", "unit"] as const;
export const PollResultVisibilityValues = ["live", "after_close"] as const;
export const ReactionKindValues = ["upvote", "downvote"] as const;
export const FeedSortValues = ["best", "hot", "new", "top", "rising"] as const;
export const RecommendationSurfaceValues = [
	"home_feed",
	"home_book",
	"home_software",
	"home_media",
	"unit_related",
	"post_related",
] as const;
export const RecommendationClientEventTypeValues = ["impression", "open", "dwell_30s"] as const;
export const RecommendationEventTypeValues = [
	...RecommendationClientEventTypeValues,
	"not_interested",
] as const;
export const RecommendationReasonValues = [
	"followed_publisher",
	"followed_realm",
	"based_on_activity",
	"related_subject",
	"popular_now",
	"new_and_relevant",
] as const;
export const RecommendationSnapshotStateValues = ["building", "ready", "failed"] as const;
export const ModerationCaseStateValues = [
	"new",
	"triaged",
	"assigned",
	"actioned",
	"resolved",
	"duplicate",
	"rejected",
	"escalated",
	"reviewing",
] as const;

export const RealmCapabilityValues = [
	"realm.contribute",
	"realm.settings.update",
	"realm.members.read",
	"realm.members.manage",
	"realm.rules.publish",
	"realm.pins.manage",
	"realm.units.moderate",
] as const;
export const EntityAssociationKindValues = ["credit", "subject"] as const;
export const EntityAssociationPolicyModeValues = [
	"open",
	"approval",
	"invite_only",
	"closed",
] as const;
export const EntityAssociationProposalDirectionValues = ["request", "invitation"] as const;
export const EntityAssociationProposalResolutionValues = [
	"accepted",
	"declined",
	"cancelled",
] as const;
export const PlatformCapabilityValues = [
	"entity.associations.override",
	"unit.edit",
	"unit.ownership.transfer",
	"unit.slug.manage",
	"unit.slug.namespace.manage",
	"unit.slug.redirect.release",
	"platform.moderate",
	"platform.suppress",
	"platform.grants.manage",
	"platform.score-context.manage",
	...RealmCapabilityValues,
] as const;

export function toEnumValues<T extends string>(values: readonly [T, ...T[]]): [T, ...T[]] {
	return [...values];
}
