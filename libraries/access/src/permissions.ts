export const UnitAccessSubjectKindValues = ["profile", "realm", "authenticated"] as const;
export type UnitAccessSubjectKind = (typeof UnitAccessSubjectKindValues)[number];

/** The dynamic Realm audience represented by a Realm Unit access subject. */
export const RealmAccessSubjectRelationValues = ["member", "access_manager"] as const;
export type RealmAccessSubjectRelation = (typeof RealmAccessSubjectRelationValues)[number];

export const UnitAccessRestrictionSubjectKindValues = ["profile", "realm"] as const;
export type UnitAccessRestrictionSubjectKind =
	(typeof UnitAccessRestrictionSubjectKindValues)[number];

export const UnitAccessInvitationResolutionValues = ["accepted", "declined", "cancelled"] as const;
export type UnitAccessInvitationResolution = (typeof UnitAccessInvitationResolutionValues)[number];

/**
 * Realm-scoped permissions stored and evaluated through Unit access.
 *
 * @alpha
 */
export const RealmPermissionValues = [
	"realm.contribute",
	"realm.units.create",
	"realm.post.replies.create",
	"realm.settings.update",
	"realm.members.read",
	"realm.members.manage",
	"realm.rules.update",
	"realm.pins.manage",
	"realm.tags.manage",
	"realm.tag-voting.update",
	"realm.tag-contexts.manage",
	"realm.units.moderate",
] as const;
export type RealmPermission = (typeof RealmPermissionValues)[number];

export const RealmUnitCreatePermissionValues = [
	"realm.units.create",
	"realm.post.replies.create",
] as const satisfies readonly RealmPermission[];
export type RealmUnitCreatePermission = (typeof RealmUnitCreatePermissionValues)[number];

export const EntityAssociationPermissionValues = [
	"entity.association.credit.request",
	"entity.association.credit.direct",
	"entity.association.subject.request",
	"entity.association.subject.direct",
] as const;
export type EntityAssociationPermission = (typeof EntityAssociationPermissionValues)[number];

/** Independently delegable operations over a Zone Unit. */
export const ZonePagesManagePermission = "zone.pages.manage" as const;
export const ZoneThemeManagePermission = "zone.theme.manage" as const;
export const ZonePermissionValues = [ZonePagesManagePermission, ZoneThemeManagePermission] as const;
export type ZonePermission = (typeof ZonePermissionValues)[number];

/**
 * Atomic permissions that may be granted on a Unit access root.
 *
 * @alpha
 */
export const UnitPermissionValues = [
	"unit.read",
	"unit.update",
	"unit.metadata-only.update",
	"unit.status.update",
	"unit.history.restore",
	"unit.access.manage",
	"unit.ownership.transfer",
	"unit.association.manage",
	"unit.tag-curation.manage",
	"unit.reference-curation.manage",
	"unit.realm-publication.manage",
	...ZonePermissionValues,
	...RealmPermissionValues,
	...EntityAssociationPermissionValues,
] as const;
export type UnitPermission = (typeof UnitPermissionValues)[number];

/**
 * Unit permissions that may be delegated through grants, restrictions, and invitations.
 *
 * @remarks
 * Ownership transfer is deliberately excluded. It is an owner-only operation whose
 * authority cannot be delegated independently from ownership.
 *
 * @alpha
 */
export type DelegableUnitPermission = Exclude<UnitPermission, "unit.ownership.transfer">;
export type OwnerOnlyUnitPermission = Extract<UnitPermission, "unit.ownership.transfer">;

function deriveDelegableUnitPermissionValues(): readonly [
	DelegableUnitPermission,
	...DelegableUnitPermission[],
] {
	const values = UnitPermissionValues.filter(
		(permission): permission is DelegableUnitPermission => permission !== "unit.ownership.transfer",
	);
	const [first, ...rest] = values;
	if (!first) throw new Error("UnitPermissionValues must contain a delegable permission");
	return [first, ...rest];
}

export const DelegableUnitPermissionValues = deriveDelegableUnitPermissionValues();

const DelegableUnitPermissions: ReadonlySet<UnitPermission> = new Set(
	DelegableUnitPermissionValues,
);

/** Returns whether a Unit permission may be stored in delegated access records. */
export function isUnitPermissionDelegable(
	permission: UnitPermission,
): permission is DelegableUnitPermission {
	return DelegableUnitPermissions.has(permission);
}

/** Returns whether a Unit permission is derived exclusively from current ownership. */
export function isUnitPermissionOwnerOnly(
	permission: UnitPermission,
): permission is OwnerOnlyUnitPermission {
	return permission === "unit.ownership.transfer";
}

/**
 * Grants access to product surfaces and APIs that have not been released.
 *
 * @remarks
 * This is a release gate, not authority to perform domain operations. Callers
 * must still satisfy every permission and resource policy required by the
 * requested operation.
 *
 * @alpha
 */
export const DevelopmentPreviewCapability = "platform.development_preview.access" as const;
export const ZoneThemeReviewCapability = "platform.zone_theme.review" as const;
export const ZoneThemeKillCapability = "platform.zone_theme.kill" as const;

/**
 * Platform-wide capabilities assignable to Profiles.
 *
 * @remarks
 * These capabilities govern global control-plane operations. They are not
 * roles, employment states, or API credential scopes.
 *
 * @alpha
 */
export const PlatformCapabilityValues = [
	"platform.access.read",
	"platform.access.manage",
	"platform.audit.read",
	"platform.user.read",
	"platform.user.status.update",
	"platform.session.read",
	"platform.session.revoke",
	"entity.associations.override",
	"unit.edit",
	DevelopmentPreviewCapability,
	ZoneThemeReviewCapability,
	ZoneThemeKillCapability,
	"unit.governance.read",
	"unit.merge.propose",
	"unit.merge.review",
	"unit.merge",
	"unit.ownership.override",
	"unit.license.manage",
	"unit.delete",
	"unit.restore",
	"unit.slug.manage",
	"unit.slug.namespace.manage",
	"unit.slug.redirect.release",
	"platform.api_quota_policy.read",
	"platform.api_quota_policy.update",
	"platform.user.api_quota.read",
	"platform.user.api_quota.update",
	"platform.user.api_token.api_quota.read",
	"platform.user.api_token.api_quota.update",
	"platform.moderate",
	"platform.suppress",
	...RealmPermissionValues,
] as const;
export type PlatformCapability = (typeof PlatformCapabilityValues)[number];

export type PlatformCapabilityDefinition = {
	readonly resource: string;
	readonly action: string;
	readonly rationale: string;
};

/**
 * Complete semantic metadata for every platform capability.
 *
 * @alpha
 */
export const PlatformCapabilityDefinitions = {
	"platform.access.read": {
		resource: "platform.access",
		action: "read",
		rationale: "Inspecting who has platform authority is independently grantable from changing it.",
	},
	"platform.access.manage": {
		resource: "platform.access",
		action: "manage",
		rationale:
			"Platform access administration intentionally bundles granting, renewing, and revoking platform capabilities.",
	},
	"platform.audit.read": {
		resource: "platform.audit",
		action: "read",
		rationale:
			"Global security audit data contains sensitive operational context and requires an independent read boundary.",
	},
	"platform.user.read": {
		resource: "platform.user",
		action: "read",
		rationale:
			"Sign-in identity and account-state data is sensitive and independently grantable from platform access administration.",
	},
	"platform.user.status.update": {
		resource: "platform.user.status",
		action: "update",
		rationale:
			"Suspending, closing, or restoring a platform account changes every authenticated product surface.",
	},
	"platform.session.read": {
		resource: "platform.session",
		action: "read",
		rationale:
			"Session metadata contains security-sensitive device, network, and activity context.",
	},
	"platform.session.revoke": {
		resource: "platform.session",
		action: "revoke",
		rationale: "Revoking a session immediately invalidates an authenticated credential.",
	},
	"entity.associations.override": {
		resource: "entity.associations",
		action: "override",
		rationale: "Overrides association consent and validation workflows across the platform.",
	},
	"unit.edit": {
		resource: "unit",
		action: "edit",
		rationale: "Provides emergency platform-wide Unit editing authority.",
	},
	[DevelopmentPreviewCapability]: {
		resource: "platform.development_preview",
		action: "access",
		rationale:
			"Controls entry to unreleased product surfaces without granting their domain operations.",
	},
	[ZoneThemeReviewCapability]: {
		resource: "platform.zone_theme",
		action: "review",
		rationale:
			"Accepts automated review evidence and makes human publication decisions for reusable custom Zone theme revisions.",
	},
	[ZoneThemeKillCapability]: {
		resource: "platform.zone_theme",
		action: "kill",
		rationale:
			"Immediately disables an approved custom Zone theme revision across every Zone that references it.",
	},
	"unit.governance.read": {
		resource: "unit.governance",
		action: "read",
		rationale:
			"Inspects platform-wide Unit lifecycle and ownership state without authorizing mutations.",
	},
	"unit.merge.propose": {
		resource: "unit.merge",
		action: "propose",
		rationale:
			"Creates an irreversible Unit merge request without granting approval or execution authority.",
	},
	"unit.merge.review": {
		resource: "unit.merge",
		action: "review",
		rationale:
			"Approves or vetoes another Profile's irreversible Unit merge request without granting direct execution authority.",
	},
	"unit.merge": {
		resource: "unit",
		action: "merge",
		rationale:
			"Directly accepts an irreversible Unit identity merge and administers retryable execution.",
	},
	"unit.ownership.override": {
		resource: "unit.ownership",
		action: "override",
		rationale:
			"Reassigns ownership of any Unit through the platform control plane, independently from per-Unit owner authority.",
	},
	"unit.license.manage": {
		resource: "unit.license",
		action: "manage",
		rationale:
			"Invalidates or restores platform recognition of Unit license grants through audited governance cases.",
	},
	"unit.delete": {
		resource: "unit",
		action: "delete",
		rationale:
			"Soft-deletes any non-bootstrap Unit through the platform Console outside ordinary Unit access.",
	},
	"unit.restore": {
		resource: "unit",
		action: "restore",
		rationale: "Restores a platform-soft-deleted Unit without granting authority over its content.",
	},
	"unit.slug.manage": {
		resource: "unit.slug",
		action: "manage",
		rationale: "Administers canonical Unit addresses outside ordinary owner-managed routes.",
	},
	"unit.slug.namespace.manage": {
		resource: "unit.slug.namespace",
		action: "manage",
		rationale: "Administers global slug namespaces.",
	},
	"unit.slug.redirect.release": {
		resource: "unit.slug.redirect",
		action: "release",
		rationale: "Releases reserved redirects and can affect public address integrity.",
	},
	"platform.api_quota_policy.read": {
		resource: "platform.api_quota_policy",
		action: "read",
		rationale: "Inspects API quota policy definitions without changing account limits.",
	},
	"platform.api_quota_policy.update": {
		resource: "platform.api_quota_policy",
		action: "update",
		rationale: "Publishes a new immutable revision of a platform API quota policy.",
	},
	"platform.user.api_quota.read": {
		resource: "platform.user.api_quota",
		action: "read",
		rationale: "Inspects a user's API quota assignment and effective constraints.",
	},
	"platform.user.api_quota.update": {
		resource: "platform.user.api_quota",
		action: "update",
		rationale: "Assigns or resets a user's API quota policy and custom constraints.",
	},
	"platform.user.api_token.api_quota.read": {
		resource: "platform.user.api_token.api_quota",
		action: "read",
		rationale:
			"Inspects a user's API token inventory and each token's effective quota without exposing token secrets.",
	},
	"platform.user.api_token.api_quota.update": {
		resource: "platform.user.api_token.api_quota",
		action: "update",
		rationale:
			"Assigns or resets quota policies and custom constraints for an individual API token.",
	},
	"platform.moderate": {
		resource: "platform",
		action: "moderate",
		rationale: "Applies moderation decisions across platform resources.",
	},
	"platform.suppress": {
		resource: "platform",
		action: "suppress",
		rationale: "Suppresses sensitive historical content across platform resources.",
	},
	"realm.contribute": {
		resource: "realm",
		action: "contribute",
		rationale: "Provides recovery authority for Realm contributions across the platform.",
	},
	"realm.units.create": {
		resource: "realm.units",
		action: "create",
		rationale: "Provides recovery authority to create Units in any Realm.",
	},
	"realm.post.replies.create": {
		resource: "realm.post.replies",
		action: "create",
		rationale: "Provides recovery authority to create Replies in any Realm.",
	},
	"realm.settings.update": {
		resource: "realm.settings",
		action: "update",
		rationale: "Provides recovery authority to update settings in any Realm.",
	},
	"realm.members.read": {
		resource: "realm.members",
		action: "read",
		rationale: "Provides recovery authority to inspect membership in any Realm.",
	},
	"realm.members.manage": {
		resource: "realm.members",
		action: "manage",
		rationale: "Provides recovery authority to administer membership in any Realm.",
	},
	"realm.rules.update": {
		resource: "realm.rules",
		action: "update",
		rationale: "Provides recovery authority to publish rules in any Realm.",
	},
	"realm.pins.manage": {
		resource: "realm.pins",
		action: "manage",
		rationale: "Provides recovery authority to administer pins in any Realm.",
	},
	"realm.tags.manage": {
		resource: "realm.tags",
		action: "manage",
		rationale:
			"Provides recovery authority to administer Realm taxonomy and policy Tag assertions.",
	},
	"realm.tag-voting.update": {
		resource: "realm.tag-voting",
		action: "update",
		rationale: "Provides recovery authority to change Realm Tag voting policy.",
	},
	"realm.tag-contexts.manage": {
		resource: "realm.tag-contexts",
		action: "manage",
		rationale:
			"Provides recovery authority to create, replace, and remove Realm Tag Context relationships without changing the related Wiki access policy.",
	},
	"realm.units.moderate": {
		resource: "realm.units",
		action: "moderate",
		rationale: "Provides recovery authority to moderate Units in any Realm.",
	},
} as const satisfies Record<PlatformCapability, PlatformCapabilityDefinition>;

/**
 * Canonical prerequisite access implied by a platform capability.
 *
 * @alpha
 */
export const PlatformCapabilityImplications: Partial<
	Record<PlatformCapability, readonly PlatformCapability[]>
> = {
	"platform.access.manage": ["platform.access.read"],
	"platform.user.status.update": ["platform.user.read"],
	"platform.session.revoke": ["platform.session.read", "platform.user.read"],
	"platform.api_quota_policy.update": ["platform.api_quota_policy.read"],
	"platform.user.api_quota.read": ["platform.user.read"],
	"platform.user.api_quota.update": [
		"platform.user.api_quota.read",
		"platform.api_quota_policy.read",
	],
	"platform.user.api_token.api_quota.read": ["platform.user.read"],
	"platform.user.api_token.api_quota.update": [
		"platform.user.api_token.api_quota.read",
		"platform.api_quota_policy.read",
	],
	"unit.ownership.override": ["unit.governance.read"],
	"unit.merge.propose": ["unit.governance.read"],
	"unit.merge.review": ["unit.governance.read"],
	"unit.merge": ["unit.merge.propose", "unit.merge.review"],
	"unit.license.manage": ["unit.governance.read"],
	"unit.delete": ["unit.governance.read"],
	"unit.restore": ["unit.governance.read"],
	"realm.members.manage": ["realm.members.read"],
};

/**
 * Returns the implication-closed platform capability set in canonical order.
 *
 * @alpha
 */
export function expandPlatformCapabilities(
	capabilities: readonly PlatformCapability[],
): PlatformCapability[] {
	const expanded = new Set<PlatformCapability>();
	const visit = (capability: PlatformCapability) => {
		if (expanded.has(capability)) return;
		expanded.add(capability);
		for (const implied of PlatformCapabilityImplications[capability] ?? []) visit(implied);
	};
	for (const capability of capabilities) visit(capability);
	return PlatformCapabilityValues.filter((capability) => expanded.has(capability));
}

export const StandardPermissionActionValues = ["read", "create", "update", "delete"] as const;
export type StandardPermissionAction = (typeof StandardPermissionActionValues)[number];

export type PermissionResourceKind = "unit" | "realm" | "entity" | "zone";

type StandardPermissionDefinition = {
	readonly kind: "standard";
	readonly target: PermissionResourceKind;
	readonly resource: string;
	readonly action: StandardPermissionAction;
};

type DomainPermissionDefinition = {
	readonly kind: "domain";
	readonly target: PermissionResourceKind;
	readonly resource: string;
	readonly action: string;
	readonly rationale: string;
};

export type PermissionDefinition = StandardPermissionDefinition | DomainPermissionDefinition;

/**
 * Complete semantic metadata for every Unit access permission.
 *
 * @remarks
 * Non-standard actions require a rationale so additions cannot silently expand
 * the access vocabulary without documenting their independent security boundary.
 *
 * @alpha
 */
export const UnitPermissionDefinitions = {
	"unit.read": {
		kind: "standard",
		target: "unit",
		resource: "unit",
		action: "read",
	},
	"unit.update": {
		kind: "standard",
		target: "unit",
		resource: "unit",
		action: "update",
	},
	"unit.metadata-only.update": {
		kind: "domain",
		target: "unit",
		resource: "unit.metadata-only",
		action: "update",
		rationale:
			"Changing whether REZICS may expose hosted work content is independently grantable from ordinary metadata editing.",
	},
	"unit.status.update": {
		kind: "standard",
		target: "unit",
		resource: "unit.status",
		action: "update",
	},
	"unit.history.restore": {
		kind: "domain",
		target: "unit",
		resource: "unit.history",
		action: "restore",
		rationale:
			"Restoring an immutable historical revision is independently grantable from ordinary updates.",
	},
	"unit.access.manage": {
		kind: "domain",
		target: "unit",
		resource: "unit.access",
		action: "manage",
		rationale:
			"Access governance intentionally bundles grants, restrictions, and invitations without changing ownership.",
	},
	"unit.ownership.transfer": {
		kind: "domain",
		target: "unit",
		resource: "unit.ownership",
		action: "transfer",
		rationale:
			"Ownership transfer is reserved to the current owner and cannot be delegated through access grants.",
	},
	"unit.association.manage": {
		kind: "domain",
		target: "unit",
		resource: "unit.association",
		action: "manage",
		rationale:
			"Association governance intentionally bundles the supported association mutation operations.",
	},
	"unit.tag-curation.manage": {
		kind: "domain",
		target: "unit",
		resource: "unit.tag-curation",
		action: "manage",
		rationale:
			"Tag curation independently governs pinning, ordering, and removing whole tag applications without limiting community tagging or voting.",
	},
	"unit.reference-curation.manage": {
		kind: "domain",
		target: "unit",
		resource: "unit.reference-curation",
		action: "manage",
		rationale:
			"Reference curation independently governs pinning and ordering Alias and Source Link candidates without limiting community proposals or voting.",
	},
	"unit.realm-publication.manage": {
		kind: "domain",
		target: "unit",
		resource: "unit.realm-publication",
		action: "manage",
		rationale:
			"Realm publication independently governs where a global Unit is mounted, withdrawn, or republished without granting Realm-side approval authority.",
	},
	[ZonePagesManagePermission]: {
		kind: "domain",
		target: "zone",
		resource: "zone.pages",
		action: "manage",
		rationale:
			"Zone page composition and navigation are independently delegable without granting theme management, general Unit editing, or lifecycle authority.",
	},
	[ZoneThemeManagePermission]: {
		kind: "domain",
		target: "zone",
		resource: "zone.theme",
		action: "manage",
		rationale:
			"Zone theme management is independently delegable without granting page composition, navigation, general Unit editing, or lifecycle authority.",
	},
	"realm.contribute": {
		kind: "domain",
		target: "realm",
		resource: "realm",
		action: "contribute",
		rationale:
			"Realm participation covers non-Unit contributions such as votes and contextual interactions.",
	},
	"realm.units.create": {
		kind: "standard",
		target: "realm",
		resource: "realm.units",
		action: "create",
	},
	"realm.post.replies.create": {
		kind: "standard",
		target: "realm",
		resource: "realm.post.replies",
		action: "create",
	},
	"realm.settings.update": {
		kind: "standard",
		target: "realm",
		resource: "realm.settings",
		action: "update",
	},
	"realm.members.read": {
		kind: "standard",
		target: "realm",
		resource: "realm.members",
		action: "read",
	},
	"realm.members.manage": {
		kind: "domain",
		target: "realm",
		resource: "realm.members",
		action: "manage",
		rationale:
			"Membership governance intentionally bundles admission and member-state transitions.",
	},
	"realm.rules.update": {
		kind: "standard",
		target: "realm",
		resource: "realm.rules",
		action: "update",
	},
	"realm.pins.manage": {
		kind: "domain",
		target: "realm",
		resource: "realm.pins",
		action: "manage",
		rationale:
			"Pin governance intentionally bundles adding, ordering, changing, and removing Realm pins.",
	},
	"realm.tags.manage": {
		kind: "domain",
		target: "realm",
		resource: "realm.tags",
		action: "manage",
		rationale:
			"Realm Tag governance controls Realm taxonomy and direct Realm policy Tag assertions without changing global Tags or Tag Context relationships.",
	},
	"realm.tag-voting.update": {
		kind: "standard",
		target: "realm",
		resource: "realm.tag-voting",
		action: "update",
	},
	"realm.tag-contexts.manage": {
		kind: "domain",
		target: "realm",
		resource: "realm.tag-contexts",
		action: "manage",
		rationale:
			"The canonical Realm–Tag–Wiki relationship is independently governable from Realm taxonomy and from the related Wiki's content and access policy.",
	},
	"realm.units.moderate": {
		kind: "domain",
		target: "realm",
		resource: "realm.units",
		action: "moderate",
		rationale:
			"Moderation is an independently grantable governance operation over Realm-mounted Units.",
	},
	"entity.association.credit.request": {
		kind: "domain",
		target: "entity",
		resource: "entity.association.credit",
		action: "request",
		rationale:
			"Requesting a credit association starts a consent workflow rather than creating the association.",
	},
	"entity.association.credit.direct": {
		kind: "domain",
		target: "entity",
		resource: "entity.association.credit",
		action: "direct",
		rationale: "Direct association bypasses the request workflow and is independently grantable.",
	},
	"entity.association.subject.request": {
		kind: "domain",
		target: "entity",
		resource: "entity.association.subject",
		action: "request",
		rationale:
			"Requesting a subject association starts a consent workflow rather than creating it.",
	},
	"entity.association.subject.direct": {
		kind: "domain",
		target: "entity",
		resource: "entity.association.subject",
		action: "direct",
		rationale: "Direct association bypasses the request workflow and is independently grantable.",
	},
} as const satisfies Record<UnitPermission, PermissionDefinition>;

/**
 * Canonical permission implications.
 *
 * @remarks
 * `unit.status.update` is supplemental to `unit.update`; it intentionally does
 * not imply general update authority.
 *
 * @alpha
 */
export const UnitPermissionImplications: Partial<
	Record<UnitPermission, readonly UnitPermission[]>
> = {
	"unit.update": ["unit.read"],
	"unit.metadata-only.update": ["unit.read"],
	"unit.status.update": ["unit.read"],
	"unit.history.restore": ["unit.read", "unit.update"],
	"unit.access.manage": ["unit.read"],
	"unit.ownership.transfer": ["unit.read"],
	"unit.association.manage": ["unit.read"],
	"unit.tag-curation.manage": ["unit.read"],
	"unit.reference-curation.manage": ["unit.read"],
	"unit.realm-publication.manage": ["unit.read"],
	[ZonePagesManagePermission]: ["unit.read"],
	[ZoneThemeManagePermission]: ["unit.read"],
	"realm.contribute": ["unit.read"],
	"realm.units.create": ["unit.read"],
	"realm.post.replies.create": ["unit.read"],
	"realm.settings.update": ["unit.read"],
	"realm.members.read": ["unit.read"],
	"realm.members.manage": ["unit.read", "realm.members.read"],
	"realm.rules.update": ["unit.read"],
	"realm.pins.manage": ["unit.read"],
	"realm.tags.manage": ["unit.read"],
	"realm.tag-voting.update": ["unit.read"],
	"realm.tag-contexts.manage": ["unit.read"],
	"realm.units.moderate": ["unit.read"],
	"entity.association.credit.request": ["unit.read"],
	"entity.association.credit.direct": ["unit.read", "entity.association.credit.request"],
	"entity.association.subject.request": ["unit.read"],
	"entity.association.subject.direct": ["unit.read", "entity.association.subject.request"],
};

export const AuthenticatedGrantableUnitPermissionValues = [
	"unit.read",
	"unit.update",
	"realm.contribute",
	"realm.units.create",
	"realm.post.replies.create",
	"entity.association.credit.request",
	"entity.association.credit.direct",
	"entity.association.subject.request",
	"entity.association.subject.direct",
] as const satisfies readonly UnitPermission[];

const AuthenticatedGrantableUnitPermissions: ReadonlySet<UnitPermission> = new Set(
	AuthenticatedGrantableUnitPermissionValues,
);

/**
 * Returns whether a permission is safe to assign to the authenticated subject kind.
 *
 * @alpha
 */
export function isUnitPermissionGrantableToAuthenticated(permission: UnitPermission): boolean {
	return AuthenticatedGrantableUnitPermissions.has(permission);
}

/**
 * Returns whether a permission applies to the logical kind of its Unit target.
 *
 * @alpha
 */
export function isUnitPermissionApplicable(
	target: PermissionResourceKind,
	permission: UnitPermission,
): boolean {
	const permissionTarget = UnitPermissionDefinitions[permission].target;
	return permissionTarget === "unit" || permissionTarget === target;
}

/**
 * Lists permissions applicable to a logical Unit target in canonical order.
 *
 * @alpha
 */
export function unitPermissionsForTarget(target: PermissionResourceKind): UnitPermission[] {
	return UnitPermissionValues.filter((permission) =>
		isUnitPermissionApplicable(target, permission),
	);
}

/**
 * Returns the canonical implication-closed permission set.
 *
 * @alpha
 */
export function expandUnitPermissions(permissions: readonly UnitPermission[]): UnitPermission[] {
	const expanded = new Set<UnitPermission>();
	const visit = (permission: UnitPermission) => {
		if (expanded.has(permission)) return;
		expanded.add(permission);
		for (const implied of UnitPermissionImplications[permission] ?? []) visit(implied);
	};
	for (const permission of permissions) visit(permission);
	return UnitPermissionValues.filter((permission) => expanded.has(permission));
}

/**
 * Returns the implication-closed set for permissions that are safe to persist
 * in grants, restrictions, and invitations.
 *
 * @alpha
 */
export function expandDelegableUnitPermissions(
	permissions: readonly DelegableUnitPermission[],
): DelegableUnitPermission[] {
	const expanded = expandUnitPermissions(permissions);
	if (!expanded.every(isUnitPermissionDelegable))
		throw new Error("A delegable Unit permission implied owner-only authority");
	return expanded;
}
