export const UnitAccessSubjectKindValues = ["profile", "realm", "authenticated"] as const;
export type UnitAccessSubjectKind = (typeof UnitAccessSubjectKindValues)[number];

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

/**
 * Atomic permissions that may be granted on a Unit access root.
 *
 * @alpha
 */
export const UnitPermissionValues = [
	"unit.read",
	"unit.update",
	"unit.status.update",
	"unit.history.restore",
	"unit.access.manage",
	"unit.association.manage",
	"unit.tag-curation.manage",
	"unit.delete",
	...RealmPermissionValues,
	...EntityAssociationPermissionValues,
] as const;
export type UnitPermission = (typeof UnitPermissionValues)[number];

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
	"unit.ownership.transfer",
	"unit.slug.manage",
	"unit.slug.namespace.manage",
	"unit.slug.redirect.release",
	"platform.api_token_policy.manage",
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
		rationale:
			"Inspecting who has platform authority is independently grantable from changing it.",
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
	"unit.ownership.transfer": {
		resource: "unit.ownership",
		action: "transfer",
		rationale: "Transfers ownership outside the target Unit's ordinary access policy.",
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
	"platform.api_token_policy.manage": {
		resource: "platform.api_token_policy",
		action: "manage",
		rationale: "Administers platform API-token policies and privileged assignments.",
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
			"Provides recovery authority to administer Realm taxonomy, Tag contexts, and policy Tag assertions.",
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

export type PermissionResourceKind = "unit" | "realm" | "entity";

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
			"Access governance intentionally bundles grants, restrictions, invitations, and ownership administration.",
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
	"unit.delete": {
		kind: "standard",
		target: "unit",
		resource: "unit",
		action: "delete",
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
			"Realm Tag governance independently controls Realm taxonomy, Tag explanations, and direct Realm policy Tag assertions without changing global Tags.",
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
		rationale:
			"Direct association bypasses the request workflow and is independently grantable.",
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
		rationale:
			"Direct association bypasses the request workflow and is independently grantable.",
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
	"unit.status.update": ["unit.read"],
	"unit.history.restore": ["unit.read", "unit.update"],
	"unit.access.manage": ["unit.read"],
	"unit.association.manage": ["unit.read"],
	"unit.tag-curation.manage": ["unit.read"],
	"unit.delete": ["unit.read"],
	"realm.contribute": ["unit.read"],
	"realm.units.create": ["unit.read"],
	"realm.post.replies.create": ["unit.read"],
	"realm.settings.update": ["unit.read"],
	"realm.members.read": ["unit.read"],
	"realm.members.manage": ["unit.read", "realm.members.read"],
	"realm.rules.update": ["unit.read"],
	"realm.pins.manage": ["unit.read"],
	"realm.tags.manage": ["unit.read"],
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
