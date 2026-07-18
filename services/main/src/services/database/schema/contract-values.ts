export const DefaultLanguage = "zh-hant";

export const UnitKindValues = [
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

export const UnitStatusValues = ["draft", "published", "archived"] as const;
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
	"follow",
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
export const UnitAccessRoleValues = [
	"viewer",
	"editor",
	"publisher",
	"maintainer",
	"owner",
] as const;
export const UnitPermissionValues = [
	"unit.read",
	"unit.update",
	"unit.publish",
	"unit.history.restore",
	"unit.access.manage",
	"unit.protection.manage",
	"unit.delete",
] as const;
export const UnitProtectionModeValues = ["frozen", "owner_only"] as const;
export const RealmJoinPolicyValues = ["open", "approval"] as const;
export const RealmMemberRoleValues = ["owner", "admin", "moderator", "member"] as const;
export const RealmMemberStateValues = ["active", "pending", "muted", "removed", "banned"] as const;
export const RealmPinKindValues = ["pinned", "highlight"] as const;
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
	"followed_author",
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
export const PlatformCapabilityValues = [
	"unit.edit",
	"platform.moderate",
	"platform.suppress",
	"platform.grants.manage",
	...RealmCapabilityValues,
] as const;

export function toEnumValues<T extends string>(values: readonly [T, ...T[]]): [T, ...T[]] {
	return [...values];
}
