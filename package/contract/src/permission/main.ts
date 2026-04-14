import type { Permission } from "./core";

export function verifyRoot(permission: Permission): boolean {
  return permission.role === "ROOT";
}

export function verifyAdmin(permission: Permission): boolean {
  return permission.role === "ADMIN";
}

export function verifyBlocked(permission: Permission): boolean {
  if (!permission.role) {
    return true;
  }
  return permission.role === "BLOCKED";
}
