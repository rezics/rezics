import { UnitAccessRoleValues, UnitPermissionValues } from "../../database/schema/contract-values";

export type UnitAccessRole = (typeof UnitAccessRoleValues)[number];
export type UnitPermission = (typeof UnitPermissionValues)[number];

const RolePermissions = {
	viewer: ["unit.read"],
	editor: ["unit.read", "unit.update"],
	publisher: ["unit.read", "unit.update", "unit.publish"],
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

export function isPubliclyReadableUnit(status: string, visibility: string): boolean {
	return status === "published" && (visibility === "public" || visibility === "unlisted");
}
