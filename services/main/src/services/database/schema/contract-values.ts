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
export const EntityKindValues = ["person", "organization", "character", "software_agent"] as const;
export const CommunityOwnedUnitKindValues = [
	"book",
	"software",
	"media",
	"series",
	"tag",
	"structure",
] as const;

export const VariantCapableUnitKindValues = ["book", "software", "media", "entity"] as const;
/** Unit kinds that can make an authoritative content-consumption language declaration. */
export const ContentLanguageSupportUnitKindValues = [
	"book",
	"software",
	"media",
	"video",
	"audio",
	"release",
] as const;
export type ContentLanguageSupportUnitKind = (typeof ContentLanguageSupportUnitKindValues)[number];
/** Direct, non-recursive evidence lanes exposed to content-language editors. */
export const ContentLanguageEvidenceSourceValues = [
	"parent",
	"main",
	"variant",
	"release",
	"occurrence",
	"adapted_audio",
] as const;
export type ContentLanguageEvidenceSource = (typeof ContentLanguageEvidenceSourceValues)[number];
export const MaximumContentLanguageEvidencePageSize = 50;
/** Unit kinds whose content-hosting choice is persisted as descriptive metadata. */
export const MetadataOnlyUnitKindValues = ["book", "software", "media"] as const;
export type MetadataOnlyUnitKind = (typeof MetadataOnlyUnitKindValues)[number];
/** Unit kinds released for irreversible identity convergence in merge policy v1. */
export const UnitMergeEligibleKindValues = ["book", "software", "media", "entity"] as const;
export type UnitMergeEligibleKind = (typeof UnitMergeEligibleKindValues)[number];

export const UnitMergeRequestModeValues = ["reviewed", "privileged_direct"] as const;
export type UnitMergeRequestMode = (typeof UnitMergeRequestModeValues)[number];
export const UnitMergeRequestStateValues = [
	"pending_review",
	"accepted",
	"rejected",
	"expired",
	"superseded",
	"executing",
	"completed",
	"failed",
] as const;
export type UnitMergeRequestState = (typeof UnitMergeRequestStateValues)[number];
export const UnitMergeReviewDecisionValues = ["approve", "reject"] as const;
export type UnitMergeReviewDecision = (typeof UnitMergeReviewDecisionValues)[number];
export const UnitMergeOperationStateValues = [
	"pending",
	"processing",
	"retry_wait",
	"completed",
	"failed",
] as const;
export type UnitMergeOperationState = (typeof UnitMergeOperationStateValues)[number];
export const UnitMergeGraphRoleValues = ["standalone", "variant", "main"] as const;
export type UnitMergeGraphRole = (typeof UnitMergeGraphRoleValues)[number];
export const UnitMergeGraphActionValues = [
	"none",
	"detach_source",
	"reparent_source_variants_to_target",
	"reparent_source_variants_to_target_main",
	"promote_target_from_source",
] as const;
export type UnitMergeGraphAction = (typeof UnitMergeGraphActionValues)[number];
/**
 * Durable, ordered execution phases. Appending before `finalize` is a persisted
 * contract change; renaming or reordering a released phase requires a cutover.
 */
export const UnitMergeOperationPhaseValues = [
	"variant_graph",
	"slug_addresses",
	"slug_scopes",
	"aliases",
	"external_links",
	"external_link_sources",
	"software_requirements",
	"software_requirement_platforms",
	"unit_reactions",
	"unit_shares",
	"unit_follows",
	"scores",
	"collection_items",
	"unit_tags",
	"realm_tag_votes",
	"profile_unit_tags",
	"realm_pins",
	"realm_units",
	"realm_unit_tags",
	"post_subjects",
	"association_proposal_sources",
	"association_proposal_targets",
	"credit_sources",
	"credit_targets",
	"subject_sources",
	"subject_entities",
	"release_parents",
	"series_releases",
	"poll_options",
	"content_nodes_content",
	"content_nodes_target",
	"structure_members",
	"structure_edges_parent",
	"structure_edges_child",
	"structure_applications",
	"progress_entries",
	"progress_snapshots",
	"notification_subjects",
	"derived_state",
	"finalize",
] as const;
export type UnitMergeOperationPhase = (typeof UnitMergeOperationPhaseValues)[number];
export const TimedMediaUnitKindValues = ["video", "audio"] as const;
/** Request-path bound for replacing or reading external Audio tracks on one Video. */
export const MaximumAudioTracksPerVideo = 64;
/** Public Unit-detail preview bound for Tags attached to one associated Entity. */
export const SubjectAssociationEntityTagPreviewLimit = 4;
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
export type EntityKind = (typeof EntityKindValues)[number];
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

/** The single primary source recorded for one Unit revision. */
export const UnitRevisionPrimaryContributionKindValues = ["unattributed", "human", "ai"] as const;
export type UnitRevisionPrimaryContributionKind =
	(typeof UnitRevisionPrimaryContributionKindValues)[number];

/** Revision-specific work performed by an AI Entity. */
export const RevisionContributionRoleValues = [
	"creator",
	"editor",
	"translator",
	"researcher",
] as const;
export type RevisionContributionRole = (typeof RevisionContributionRoleValues)[number];

/** Evidence strength is derived by the server and never accepted from clients. */
export const RevisionAttributionAssuranceValues = [
	"self_declared",
	"credential_bound",
	"server_observed",
] as const;
export type RevisionAttributionAssurance = (typeof RevisionAttributionAssuranceValues)[number];

export const CreditAttributionUnitKindValues = [
	"book",
	"software",
	"media",
	"series",
	"entity",
	"collection",
	"release",
	"video",
	"audio",
] as const satisfies readonly UnitKind[];
export type CreditAttributionUnitKind = (typeof CreditAttributionUnitKindValues)[number];

/** Roles shared by aggregate Media and its concrete timed-media Units. */
export const MediaCreditAttributionRoleValues = [
	"director",
	"producer",
	"writer",
	"publisher",
	"composer",
	"actor",
	"narrator",
	"studio",
	"distributor",
] as const satisfies readonly CreditAttributionRole[];

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
	software: [
		"developer",
		"publisher",
		"composer",
		"designer",
		"director",
		"producer",
		"writer",
		"translator",
		"illustrator",
		"editor",
	],
	media: MediaCreditAttributionRoleValues,
	series: ["author", "editor", "publisher"],
	entity: ["publisher", "actor"],
	collection: ["publisher"],
	release: ["developer", "publisher", "distributor", "translator", "editor", "producer", "studio"],
	video: MediaCreditAttributionRoleValues,
	audio: MediaCreditAttributionRoleValues,
} as const satisfies Record<CreditAttributionUnitKind, readonly CreditAttributionRole[]>;

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

export function isEntityKind(value: string): value is EntityKind {
	return (EntityKindValues as readonly string[]).includes(value);
}

export function isCreditAttributionRole(value: string): value is CreditAttributionRole {
	return (CreditAttributionRoleValues as readonly string[]).includes(value);
}

export function isCreditAttributionUnitKind(kind: UnitKind): kind is CreditAttributionUnitKind {
	return CreditAttributionUnitKindValues.some((value) => value === kind);
}

export function isCreditAttributionRoleForUnitKind(
	kind: CreditAttributionUnitKind,
	role: CreditAttributionRole,
): boolean {
	const roles: readonly CreditAttributionRole[] = CreditAttributionRolesByUnitKind[kind];
	return roles.includes(role);
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
export const WorkReleaseStatusValues = ["ongoing", "hiatus", "completed", "cancelled"] as const;
export type WorkReleaseStatus = (typeof WorkReleaseStatusValues)[number];
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
export {
	LicenseRecognitionStatusValues,
	type LicenseRecognitionStatus,
} from "@rezics/license";
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
	"invalidate_license",
	"restore_license",
	"dismiss",
	"note",
] as const;
export const ContentReviewAuthorityValues = ["platform", "realm"] as const;
export const ContentReviewCaseStateValues = [
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
export const ActiveContentReviewCaseStateValues = [
	"new",
	"triaged",
	"assigned",
	"escalated",
	"reviewing",
] as const satisfies readonly (typeof ContentReviewCaseStateValues)[number][];
export const ContentGovernanceActionKindValues = [
	"approve",
	"hide",
	"remove",
	"restore",
	"lock_post_targeting",
	"unlock_post_targeting",
	"invalidate_license",
	"restore_license",
	"reverse",
] as const;

export const ContentGovernanceRuleBackedActionKindValues = [
	"approve",
	"hide",
	"remove",
	"restore",
	"lock_post_targeting",
	"unlock_post_targeting",
	"invalidate_license",
] as const satisfies readonly (typeof ContentGovernanceActionKindValues)[number][];
export const ContentReviewReportCounterBuckets = 256;
export const AccountEnforcementActionKindValues = ["issue", "revoke"] as const;
/** The authority whose policy decision is being recorded. */
export const GovernanceAuthorityKindValues = ["platform", "realm", "zone", "unit"] as const;
/**
 * Every governance decision either cites immutable Rule records or reverses one
 * earlier decision. Workflow events that are not policy decisions stay outside
 * this ledger.
 */
export const GovernanceDecisionBasisKindValues = ["rules", "reversal"] as const;
export const GovernanceMaxRuleSources = 2;
export const GovernanceMaxRuleReferences = 32;
export const GovernanceNoteRoleValues = ["evidence", "internal_note", "public_notice"] as const;
export const GovernanceNoteSubjectKindValues = [
	"content_review_case",
	"content_governance_action",
	"account_enforcement_action",
	"unit_access_restriction",
	"realm_unit_status_event",
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
export const UnitReferenceCurationKindValues = ["alias", "external_link"] as const;
export type UnitReferenceCurationKind = (typeof UnitReferenceCurationKindValues)[number];
/** Maximum active references of one kind owned by one Unit. */
export const UnitReferenceActiveLimit = 128;
/** Maximum curated references of one kind owned by one Unit. */
export const UnitReferencePinnedLimit = 16;
export const UnitReferencePageDefault = 20;
export const UnitReferencePageMaximum = 50;
export const UnitExternalLinkPreviewLimit = 16;
export const PollModeValues = ["single", "multiple"] as const;
export const PollOptionSourceKindValues = ["literal", "unit"] as const;
export const PollResultVisibilityValues = ["live", "after_close"] as const;
export const ReactionKindValues = ["upvote", "downvote"] as const;
export const FeedSortValues = ["best", "new"] as const;
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
export const AssociationKindValues = ["credit", "subject"] as const;
export type AssociationKind = (typeof AssociationKindValues)[number];
export const AssociationProposalDirectionValues = ["request", "invitation"] as const;
export const AssociationProposalResolutionValues = ["accepted", "declined", "cancelled"] as const;

export const ApiQuotaPolicyClassValues = ["standard", "privileged"] as const;
export const ApiQuotaPolicySubjectKindValues = ["account", "token"] as const;

export function toEnumValues<T extends string>(values: readonly [T, ...T[]]): [T, ...T[]] {
	return [...values];
}
