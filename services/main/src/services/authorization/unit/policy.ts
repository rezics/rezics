import { UnitAccessRoleValues, UnitPermissionValues } from "../../database/schema/contract-values";

export type UnitAccessRole = (typeof UnitAccessRoleValues)[number];
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

const RolePermissions = {
	viewer: ["unit.read"],
	editor: ["unit.read", "unit.update"],
	publishing_editor: ["unit.read", "unit.update", "unit.publish"],
	maintainer: [
		"unit.read",
		"unit.update",
		"unit.publish",
		"unit.history.restore",
		"unit.access.manage",
		"unit.protection.manage",
	],
	owner: UnitPermissionValues,
} as const satisfies Record<UnitAccessRole, readonly UnitPermission[]>;

export function roleAllows(role: UnitAccessRole, permission: UnitPermission): boolean {
	return (RolePermissions[role] as readonly UnitPermission[]).includes(permission);
}

/**
 * Platform authority is the recovery boundary. Direct Profile ownership only
 * suppresses Realm-derived restrictions; an explicit Profile deny remains authoritative.
 */
export function resolveUnitAccessOverride(input: {
	readonly platformOverride: boolean;
	readonly hasDirectProfileOwner: boolean;
	readonly restrictions: readonly UnitAccessRestrictionCandidate[];
}): UnitAccessOverride {
	if (input.platformOverride) return { kind: "platform" };
	const profileRestriction = input.restrictions.find(
		(restriction) => restriction.subjectKind === "profile",
	);
	if (profileRestriction) return { kind: "restriction", restriction: profileRestriction };
	if (input.hasDirectProfileOwner) return undefined;
	const realmRestriction = input.restrictions.find(
		(restriction) => restriction.subjectKind === "realm",
	);
	return realmRestriction ? { kind: "restriction", restriction: realmRestriction } : undefined;
}

export function isPubliclyReadableUnit(status: string, visibility: string): boolean {
	return status === "published" && (visibility === "public" || visibility === "unlisted");
}
