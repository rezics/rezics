import type { RezicsSessionClaims } from "@rezics/contract";

type HistoryUnit = {
  id: string;
  userId?: string | null;
  visibility?: string | null;
  status?: string | null;
};

type HistoryActor = Pick<RezicsSessionClaims, "userId" | "permission"> | null;

function isPrivileged(actor: HistoryActor): boolean {
  const role = actor?.permission?.role;
  return role === "ADMIN" || role === "ROOT";
}

function isOwner(actor: HistoryActor, unit: HistoryUnit): boolean {
  return actor?.userId != null && unit.userId === actor.userId;
}

export function canViewHistoryMetadata(
  actor: HistoryActor,
  unit: HistoryUnit | null,
): boolean {
  if (!unit || unit.status === "DELETED") return false;
  if (unit.visibility === "PUBLIC") return true;
  return isPrivileged(actor) || isOwner(actor, unit);
}

export function canViewRawHistoryPayload(
  actor: HistoryActor,
  unit: HistoryUnit | null,
): boolean {
  if (!unit || !canViewHistoryMetadata(actor, unit)) return false;
  return isPrivileged(actor) || isOwner(actor, unit);
}

export function canCompareHistory(
  actor: HistoryActor,
  unit: HistoryUnit | null,
): boolean {
  return canViewHistoryMetadata(actor, unit);
}

export function canRestoreHistoryRevision(
  actor: HistoryActor,
  unit: HistoryUnit | null,
): boolean {
  if (!unit || !canViewHistoryMetadata(actor, unit)) return false;
  return isPrivileged(actor) || isOwner(actor, unit);
}
