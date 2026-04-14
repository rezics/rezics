import { t } from "elysia";
import { tokenPermissionRoleSchema, type TokenPermissionRole } from "../token";

/**
 * Canonical representation of the main server's permission model.
 * Mirrors the `User.permission` JSON structure in the server database
 * and is embedded in `rezics-session-token` claims.
 */
export const permissionSchema = t.Object({
  role: tokenPermissionRoleSchema,
});
export type Permission = { role: TokenPermissionRole };

export function isAdmin(permission: Permission) {
  return permission.role === "ADMIN";
}

export function isRoot(permission: Permission) {
  return permission.role === "ROOT";
}

export function BasicAdminPermission(permission: Permission) {
  return isAdmin(permission) || isRoot(permission);
}

export function isBlocked(permission: Permission) {
  return permission.role === "BLOCKED";
}
