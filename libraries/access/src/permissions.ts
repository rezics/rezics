export const CapabilityAuthorityValues = ["platform", "realm"] as const;
export type CapabilityAuthority = (typeof CapabilityAuthorityValues)[number];

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
	"unit.delete",
	...RealmPermissionValues,
	...EntityAssociationPermissionValues,
] as const;
export type UnitPermission = (typeof UnitPermissionValues)[number];

/**
 * Grants access to unreleased Content Structure APIs whose editors are under development.
 *
 * @alpha
 */
export const ContentStructurePreviewCapability = "unit.content_structure.preview" as const;

/**
 * Grants access to the unreleased Zone product and Zone-owned APIs.
 *
 * @alpha
 */
export const ZonePreviewCapability = "unit.zone.preview" as const;

/**
 * Platform-wide capabilities assignable to staff Profiles.
 *
 * @alpha
 */
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
	...RealmPermissionValues,
] as const;
export type PlatformCapability = (typeof PlatformCapabilityValues)[number];

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
	"unit.delete": ["unit.read"],
	"realm.contribute": ["unit.read"],
	"realm.units.create": ["unit.read"],
	"realm.post.replies.create": ["unit.read"],
	"realm.settings.update": ["unit.read"],
	"realm.members.read": ["unit.read"],
	"realm.members.manage": ["unit.read", "realm.members.read"],
	"realm.rules.update": ["unit.read"],
	"realm.pins.manage": ["unit.read"],
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
