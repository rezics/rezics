import { type UnitKind, UnitPermissionValues } from "../../database/schema/contract-values";

export type UnitPermission = (typeof UnitPermissionValues)[number];
export type UnitAccessRestrictionCandidate = {
	readonly id: string;
	readonly subjectKind: "profile" | "realm";
};

export type UnitAccessOverride =
	| { readonly kind: "platform" }
	| {
			readonly kind: "restriction";
			readonly restriction: UnitAccessRestrictionCandidate;
	  }
	| undefined;

const RealmPermissions: ReadonlySet<UnitPermission> = new Set([
	"realm.contribute",
	"realm.settings.update",
	"realm.members.read",
	"realm.members.manage",
	"realm.rules.publish",
	"realm.pins.manage",
	"realm.units.moderate",
]);
const EntityPermissions: ReadonlySet<UnitPermission> = new Set([
	"entity.association.credit.request",
	"entity.association.credit.direct",
	"entity.association.subject.request",
	"entity.association.subject.direct",
]);
const AuthenticatedGrantablePermissions: ReadonlySet<UnitPermission> = new Set([
	"unit.read",
	"unit.update",
	"realm.contribute",
	"entity.association.credit.request",
	"entity.association.credit.direct",
	"entity.association.subject.request",
	"entity.association.subject.direct",
]);

const PermissionImplications: Partial<Record<UnitPermission, readonly UnitPermission[]>> = {
	"unit.update": ["unit.read"],
	"unit.publish": ["unit.read", "unit.update"],
	"unit.history.restore": ["unit.read", "unit.update"],
	"unit.access.manage": ["unit.read"],
	"unit.association.manage": ["unit.read"],
	"unit.delete": ["unit.read"],
	"realm.contribute": ["unit.read"],
	"realm.settings.update": ["unit.read"],
	"realm.members.read": ["unit.read"],
	"realm.members.manage": ["unit.read", "realm.members.read"],
	"realm.rules.publish": ["unit.read"],
	"realm.pins.manage": ["unit.read"],
	"realm.units.moderate": ["unit.read"],
	"entity.association.credit.request": ["unit.read"],
	"entity.association.credit.direct": ["unit.read", "entity.association.credit.request"],
	"entity.association.subject.request": ["unit.read"],
	"entity.association.subject.direct": ["unit.read", "entity.association.subject.request"],
};

export function isUnitPermissionApplicable(kind: UnitKind, permission: UnitPermission): boolean {
	if (RealmPermissions.has(permission)) return kind === "realm";
	if (EntityPermissions.has(permission)) return kind === "entity";
	return true;
}

export function isUnitPermissionGrantableToAuthenticated(permission: UnitPermission): boolean {
	return AuthenticatedGrantablePermissions.has(permission);
}

export function unitPermissionsForKind(kind: UnitKind): UnitPermission[] {
	return UnitPermissionValues.filter((permission) =>
		isUnitPermissionApplicable(kind, permission),
	);
}

/** Returns the canonical, implication-closed permission set. */
export function expandUnitPermissions(permissions: readonly UnitPermission[]): UnitPermission[] {
	const expanded = new Set<UnitPermission>();
	const visit = (permission: UnitPermission) => {
		if (expanded.has(permission)) return;
		expanded.add(permission);
		for (const implied of PermissionImplications[permission] ?? []) visit(implied);
	};
	for (const permission of permissions) visit(permission);
	return UnitPermissionValues.filter((permission) => expanded.has(permission));
}

/** Platform authority and current Unit ownership are recovery boundaries. */
export function resolveUnitAccessOverride(input: {
	readonly platformOverride: boolean;
	readonly hasDirectProfileOwner: boolean;
	readonly restrictions: readonly UnitAccessRestrictionCandidate[];
}): UnitAccessOverride {
	if (input.platformOverride) return { kind: "platform" };
	if (input.hasDirectProfileOwner) return undefined;
	const profileRestriction = input.restrictions.find(
		(restriction) => restriction.subjectKind === "profile",
	);
	if (profileRestriction) return { kind: "restriction", restriction: profileRestriction };
	const realmRestriction = input.restrictions.find(
		(restriction) => restriction.subjectKind === "realm",
	);
	return realmRestriction ? { kind: "restriction", restriction: realmRestriction } : undefined;
}

export function isPubliclyReadableUnit(status: string, visibility: string): boolean {
	return status === "published" && (visibility === "public" || visibility === "unlisted");
}
