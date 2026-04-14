import type { AuthIdentity } from "./core";

export function verifyRoot(actor: AuthIdentity): boolean {
  return actor.role === "ROOT";
}

export function verifyAdmin(actor: AuthIdentity): boolean {
  return actor.role === "ADMIN";
}

export function verifyBlocked(actor: AuthIdentity): boolean {
  if (!actor.role) {
    return true;
  }
  return actor.role === "BLOCKED";
}
