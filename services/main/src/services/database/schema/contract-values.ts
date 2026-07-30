export {
	ChineseContentDisplayValues,
	ContentLanguageValues,
	DefaultChineseContentDisplay,
	DefaultContentLanguage,
	DefaultPreferredLanguage,
	DefaultStoredUiLocale,
	DeliveryLocaleValues,
	StoredUiLocaleValues,
} from "@rezics/i18n";
export type {
	ChineseContentDisplay,
	ContentLanguage,
	DeliveryLocale,
	StoredUiLocale,
} from "@rezics/i18n";

export const UnitKindValues = [
	"slug_namespace",
	"profile",
	"book",
	"software",
	"media",
	"video",
	"audio",
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
export const CommunityOwnedUnitKindValues = [
	"book",
	"software",
	"media",
	"series",
	"tag",
	"structure",
] as const;

export const VariantCapableUnitKindValues = ["book", "software", "media"] as const;
export const TimedMediaUnitKindValues = ["video", "audio"] as const;
export const UnitOwnershipModeValues = ["profile_owned", "community_owned"] as const;
export const UnitOwnershipClaimableUnitKindValues = [
	"entity",
	"book",
	"media",
	"software",
] as const;
export const UnitOwnershipClaimResolutionValues = [
	"approved",
	"rejected",
	"withdrawn",
	"superseded",
] as const;

export type UnitKind = (typeof UnitKindValues)[number];
export type UnitOwnershipMode = (typeof UnitOwnershipModeValues)[number];
export type UnitOwnershipClaimableUnitKind = (typeof UnitOwnershipClaimableUnitKindValues)[number];
export type UnitOwnershipClaimResolution = (typeof UnitOwnershipClaimResolutionValues)[number];
export type NonRealmUnitKind = Exclude<UnitKind, "realm">;

function deriveNonRealmUnitKindValues(): readonly [NonRealmUnitKind, ...NonRealmUnitKind[]] {
	const values = UnitKindValues.filter((value): value is NonRealmUnitKind => value !== "realm");
	const [first, ...rest] = values;
	if (!first) throw new Error("UnitKindValues must contain a non-Realm kind");
	return [first, ...rest];
}

export const NonRealmUnitKindValues = deriveNonRealmUnitKindValues();
export type VariantCapableUnitKind = (typeof VariantCapableUnitKindValues)[number];
export type TimedMediaUnitKind = (typeof TimedMediaUnitKindValues)[number];

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
		"publisher",
		"composer",
		"actor",
		"narrator",
		"studio",
		"distributor",
	],
	series: ["author", "editor", "publisher"],
	entity: ["publisher"],
	collection: ["publisher"],
} as const satisfies Record<
	"book" | "software" | "media" | "series" | "entity" | "collection",
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

export function isCreditAttributionUnitKind(kind: UnitKind): kind is CreditAttributionUnitKind {
	return Object.hasOwn(CreditAttributionRolesByUnitKind, kind);
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
export const ResourceVisibilityValues = ["public", "unlisted", "private"] as const;
export type ResourceVisibility = (typeof ResourceVisibilityValues)[number];
export const DefaultResourceVisibility = "public" satisfies ResourceVisibility;
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
	"page",
	"wiki",
	"picture",
	"governance_note",
] as const;
export type PostKind = (typeof PostKindValues)[number];
export const RealmScoreContextPostKindValues = [
	"post",
	"wiki",
] as const satisfies readonly PostKind[];

/** Persisted as text so kind schemas can evolve without a PostgreSQL enum migration. */
export const ContentStructureKindValues = [
	"book.contents",
	"media.contents",
	"post.contents",
	"realm.taxonomy",
	"wiki.navigation",
	"zone.navigation",
	"page-structure",
] as const;
export type ContentStructureKind = (typeof ContentStructureKindValues)[number];

export const ContentStructureTargetKindValues = ["content", "none", "unit", "external"] as const;
export type ContentStructureTargetKind = (typeof ContentStructureTargetKindValues)[number];

export const RealmTagQueryStrategyValues = [
	"global_effective",
	"realm_community",
	"realm_policy",
] as const;
export type RealmTagQueryStrategy = (typeof RealmTagQueryStrategyValues)[number];
export const ProgressStatusValues = [
	"backlog",
	"active",
	"paused",
	"completed",
	"dropped",
] as const;
export type ProgressStatus = (typeof ProgressStatusValues)[number];
export const ProgressEntryKindValues = ["update", "completion"] as const;
export type ProgressEntryKind = (typeof ProgressEntryKindValues)[number];
export const ProgressDatePrecisionValues = ["instant", "day", "month", "year", "unknown"] as const;
export type ProgressDatePrecision = (typeof ProgressDatePrecisionValues)[number];
export const ProgressCurrentBasisValues = ["journal", "reading"] as const;
export type ProgressCurrentBasis = (typeof ProgressCurrentBasisValues)[number];
export const NotificationKindValues = [
	"reply",
	"new_follower",
	"direct_message",
	"moderation",
	"realm",
	"system",
] as const;
export const EnforcementKindValues = [
	"warning",
	"silence",
	"suspension",
	"ban",
	"rate_limit",
	"trust_restriction",
] as const;
export const RealmJoinPolicyValues = ["open", "approval"] as const;
export const RealmRuleAcknowledgementModeValues = ["explicit", "implicit_on_follow"] as const;

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
export const RealmPageKindValues = ["main", "tags", "wiki"] as const;
export type RealmPageKind = (typeof RealmPageKindValues)[number];
export const RealmPinKindValues = ["pinned", "highlight"] as const;
export const RealmUnitStatusValues = ["pending", "visible", "hidden", "removed"] as const;
export const RealmUnitPublicationStateValues = ["active", "withdrawn"] as const;
export const UserAccountStateValues = ["active", "suspended", "closed"] as const;
export type UserAccountState = (typeof UserAccountStateValues)[number];
export const UserAccountStateReasonValues = [
	"security",
	"policy_violation",
	"compromised",
	"user_request",
	"legal",
	"other",
] as const;
export type UserAccountStateReason = (typeof UserAccountStateReasonValues)[number];
export const RealmUnitMutationCommandValues = [
	"approve",
	"hide",
	"remove",
	"restore",
	"lock_post_targeting",
	"unlock_post_targeting",
] as const;
export const RealmModerationCommandValues = [
	...RealmUnitMutationCommandValues,
	"dismiss",
	"note",
] as const;
export const PlatformUnitModerationCommandValues = [
	"approve",
	"remove",
	"restore",
	"lock_post_targeting",
	"unlock_post_targeting",
	"dismiss",
	"note",
] as const;
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
	"dismiss",
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
export const ActiveReportCaseStateValues = [
	"new",
	"triaged",
	"assigned",
	"escalated",
	"reviewing",
] as const satisfies readonly (typeof ModerationCaseStateValues)[number][];

export const AssociationKindValues = ["credit", "subject"] as const;
export type AssociationKind = (typeof AssociationKindValues)[number];
export const AssociationProposalDirectionValues = ["request", "invitation"] as const;
export const AssociationProposalResolutionValues = ["accepted", "declined", "cancelled"] as const;

export const ApiTokenPolicyKindValues = ["standard", "privileged"] as const;
export const ApiTokenUsageBucketKindValues = ["minute_requests", "daily_cost"] as const;

export function toEnumValues<T extends string>(values: readonly [T, ...T[]]): [T, ...T[]] {
	return [...values];
}
