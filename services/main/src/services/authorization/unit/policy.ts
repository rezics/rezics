import {
	expandUnitPermissions,
	isUnitPermissionApplicable as isPermissionApplicableToTarget,
	isUnitPermissionGrantableToAuthenticated,
	type PermissionResourceKind,
	type UnitPermission,
	unitPermissionsForTarget,
} from "@rezics/access";

import type { UnitKind } from "../../database/schema/contract-values";

export { expandUnitPermissions, isUnitPermissionGrantableToAuthenticated };
export type { UnitPermission };
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

export function isUnitPermissionApplicable(kind: UnitKind, permission: UnitPermission): boolean {
	return isPermissionApplicableToTarget(permissionTargetForUnitKind(kind), permission);
}

export function unitPermissionsForKind(kind: UnitKind): UnitPermission[] {
	return unitPermissionsForTarget(permissionTargetForUnitKind(kind));
}

function permissionTargetForUnitKind(kind: UnitKind): PermissionResourceKind {
	if (kind === "realm") return "realm";
	if (kind === "entity") return "entity";
	return "unit";
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
