export {
	ContentLanguageValues,
	DefaultContentLanguage,
	DefaultPreferredLanguage,
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
	"label",
	"tag",
	"structure",
	"series",
	"zone",
	"zone_page",
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
	"tag",
	"structure",
] as const;

export const VariantCapableUnitKindValues = ["book", "software", "media"] as const;

export type UnitKind = (typeof UnitKindValues)[number];
export type VariantCapableUnitKind = (typeof VariantCapableUnitKindValues)[number];

export const CreditAttributionRoleValues = [
	"author",
	"co-author",
	"translator",
	"illustrator",
	"editor",
	"publisher",
	"letterer",
	"colorist",
	"developer",
	"composer",
	"designer",
	"director",
	"producer",
	"writer",
	"actor",
	"narrator",
	"studio",
	"distributor",
] as const;
export type CreditAttributionRole = (typeof CreditAttributionRoleValues)[number];

export const CreditAttributionRolesByUnitKind = {
	book: [
		"author",
		"co-author",
		"translator",
		"illustrator",
		"editor",
		"publisher",
		"letterer",
		"colorist",
	],
	software: ["developer", "publisher", "composer", "designer", "director", "producer", "writer"],
	media: [
		"director",
		"producer",
		"writer",
		"composer",
		"actor",
		"narrator",
		"studio",
		"distributor",
	],
	series: ["author", "editor", "publisher"],
} as const satisfies Record<
	"book" | "software" | "media" | "series",
	readonly CreditAttributionRole[]
>;
export type CreditAttributionUnitKind = keyof typeof CreditAttributionRolesByUnitKind;

export const SubjectAssociationRoleValues = [
	"primary_character",
	"featured_character",
	"appears",
	"about",
	"setting",
	"source_work",
	"canonical_wiki_page",
	"related_subject",
] as const;
export type SubjectAssociationRole = (typeof SubjectAssociationRoleValues)[number];
export type AssociationRole = CreditAttributionRole | SubjectAssociationRole;

export function isCreditAttributionRole(value: string): value is CreditAttributionRole {
	return (CreditAttributionRoleValues as readonly string[]).includes(value);
}

export function isCreditAttributionRoleForUnitKind(
	kind: CreditAttributionUnitKind,
	role: CreditAttributionRole,
): boolean {
	return (CreditAttributionRolesByUnitKind[kind] as readonly CreditAttributionRole[]).includes(
		role,
	);
}

export function isSubjectAssociationRole(value: string): value is SubjectAssociationRole {
	return (SubjectAssociationRoleValues as readonly string[]).includes(value);
}

/**
 * Persisted semantic contracts for community-immutable ordered Unit structures.
 *
 * The storage primitive is generic; each kind defines which member Unit kinds
 * and which interpretation of adjacency are valid.
 */
export const UnitStructureKindValues = ["tag.hierarchy_path"] as const;
export type UnitStructureKind = (typeof UnitStructureKindValues)[number];

export const DockKindValues = ["main", "wiki"] as const;
export type DockKind = (typeof DockKindValues)[number];
export const DockOwnerUnitKindValues = ["book", "software", "media", "zone", "realm"] as const;
export type DockOwnerUnitKind = (typeof DockOwnerUnitKindValues)[number];
export const DockKindsByUnitKind = {
	book: ["main"],
	software: ["main"],
	media: ["main"],
	zone: ["main"],
	realm: ["main", "wiki"],
} as const satisfies Record<DockOwnerUnitKind, readonly DockKind[]>;

export function isDockOwnerUnitKind(kind: UnitKind): kind is DockOwnerUnitKind {
	return (DockOwnerUnitKindValues as readonly UnitKind[]).includes(kind);
}

export function isDockKindSupported(kind: UnitKind, dockKind: DockKind): boolean {
	return isDockOwnerUnitKind(kind)
		? (DockKindsByUnitKind[kind] as readonly DockKind[]).includes(dockKind)
		: false;
}

export const SlugAddressKindValues = ["canonical", "redirect"] as const;
export type SlugAddressKind = (typeof SlugAddressKindValues)[number];

export const UnitStatusValues = ["draft", "published", "archived"] as const;
export const UnitStatusActorKindValues = ["profile", "system", "import"] as const;
export const UnitVisibilityValues = ["public", "unlisted", "private"] as const;
export const ContentRatingValues = ["general", "r15", "r18", "r18g"] as const;
export type ContentRating = (typeof ContentRatingValues)[number];
export const DefaultContentRatingValues = [
	"general",
	"r15",
] as const satisfies readonly ContentRating[];
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
export const ImageAssetPresentationRoleValues = ["avatar", "banner", "cover"] as const;
export type ImageAssetPresentationRole = (typeof ImageAssetPresentationRoleValues)[number];
export const ImageAssetPresentationFitValues = ["crop", "contain"] as const;
export type ImageAssetPresentationFit = (typeof ImageAssetPresentationFitValues)[number];
export const PostKindValues = [
	"post",
	"reply",
	"excerpt",
	"review",
	"chapter",
	"wiki",
	"picture",
	"governance_note",
] as const;
export type PostKind = (typeof PostKindValues)[number];

/** Persisted as text so kind schemas can evolve without a PostgreSQL enum migration. */
export const ContentStructureKindValues = [
	"book.contents",
	"post.contents",
	"realm.taxonomy",
	"realm.navigation",
	"zone.navigation",
	"page-structure",
] as const;
export type ContentStructureKind = (typeof ContentStructureKindValues)[number];

export const ContentStructureTargetKindValues = ["content", "none", "unit", "external"] as const;
export type ContentStructureTargetKind = (typeof ContentStructureTargetKindValues)[number];
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
export const UnitAccessInvitationResolutionValues = ["accepted", "declined", "cancelled"] as const;
export const RealmCapabilityValues = [
	"realm.contribute",
	"realm.settings.update",
	"realm.members.read",
	"realm.members.manage",
	"realm.rules.publish",
	"realm.pins.manage",
	"realm.units.moderate",
] as const;
export const EntityAssociationPermissionValues = [
	"entity.association.credit.request",
	"entity.association.credit.direct",
	"entity.association.subject.request",
	"entity.association.subject.direct",
] as const;
export const UnitPermissionValues = [
	"unit.read",
	"unit.update",
	"unit.publish",
	"unit.history.restore",
	"unit.access.manage",
	"unit.association.manage",
	"unit.delete",
	...RealmCapabilityValues,
	...EntityAssociationPermissionValues,
] as const;
export const RealmJoinPolicyValues = ["open", "approval"] as const;

/**
 * Runtime states for a roleless Realm membership.
 *
 * @remarks
 * Realm membership intentionally carries no authorization role. Unit ownership
 * is the recovery boundary, while every other Realm capability is granted
 * directly through the Unit access policy.
 *
 * A future role system may introduce a localized `realm_role` Unit, a typed
 * role-to-permission relation, Profile/Realm-to-role bindings, assignment
 * constraints that prevent privilege escalation, immutable ownership
 * separation, effective-access provenance, audit history, and deterministic
 * behavior for role updates and deletion. No current API accepts a role
 * identifier, so that future design can be introduced without preserving a
 * premature contract.
 *
 * @tag low-priority
 */
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
	"followed_unit",
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

export const AssociationKindValues = ["credit", "subject"] as const;
export type AssociationKind = (typeof AssociationKindValues)[number];
export const AssociationProposalDirectionValues = ["request", "invitation"] as const;
export const AssociationProposalResolutionValues = ["accepted", "declined", "cancelled"] as const;

/**
 * Grants access to unreleased Content Structure APIs for Unit types whose
 * editors are still under development.
 *
 * @alpha
 * @remarks
 * This capability is a runtime authorization boundary. The annotation only
 * communicates release maturity and must never be treated as access control.
 */
export const ContentStructurePreviewCapability = "unit.content_structure.preview" as const;

/**
 * Grants access to the unreleased Zone product and Zone-owned APIs.
 *
 * @alpha
 * @remarks
 * This is a server-enforced product preview boundary. Unit ownership or public
 * visibility does not replace this platform capability while Zone is in
 * development.
 */
export const ZonePreviewCapability = "unit.zone.preview" as const;

export const PlatformCapabilityValues = [
	"entity.associations.override",
	"unit.edit",
	ContentStructurePreviewCapability,
	ZonePreviewCapability,
	"unit.ownership.transfer",
	"unit.slug.manage",
	"unit.slug.namespace.manage",
	"unit.slug.redirect.release",
	"platform.api_token_policy.manage",
	"platform.moderate",
	"platform.suppress",
	"platform.grants.manage",
	...RealmCapabilityValues,
] as const;

export const ApiTokenPolicyKindValues = ["standard", "staff_trusted"] as const;
export const ApiTokenUsageBucketKindValues = ["minute_requests", "daily_cost"] as const;

export function toEnumValues<T extends string>(values: readonly [T, ...T[]]): [T, ...T[]] {
	return [...values];
}
