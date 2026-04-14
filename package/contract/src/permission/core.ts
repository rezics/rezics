export type AuthIdentity = { unitId: string; role: string };

export function isAdmin(actor: AuthIdentity) {
  return actor.role === "ADMIN";
}

export function isRoot(actor: AuthIdentity) {
  return actor.role === "ROOT";
}

export function BasicAdminPermission(actor: AuthIdentity) {
  return isAdmin(actor) || isRoot(actor);
}

export function isBlocked(actor: AuthIdentity) {
  return actor.role === "BLOCKED";
}
