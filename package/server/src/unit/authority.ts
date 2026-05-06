import type { RezicsSessionClaims } from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { isAdminRole, verifyAdminFromDb } from "@/middleware";

const REALM_AUTHORITY_ROLES = ["owner", "admin", "moderator"] as const;

export interface AuthorityUnit {
  id: string;
  userId: string | null;
}

/**
 * Authority predicate per unit-authority spec / design D3.
 *
 * Returns true if caller is the unit owner, a system admin, or a
 * moderator+ of any Realm whose `RealmUnit` rows reference this unit.
 * Resolves with a single indexed JOIN against `RealmUnit × RealmMember`.
 */
export async function hasAuthorityOver(
  caller: RezicsSessionClaims | null,
  unit: AuthorityUnit,
): Promise<boolean> {
  if (!caller) return false;
  if (unit.userId && caller.userId === unit.userId) return true;

  if (isAdminRole(caller)) return true;
  if (await verifyAdminFromDb(caller.userId)) return true;

  const containingRealms = await prisma.realmUnit.findMany({
    where: { unitId: unit.id },
    select: { realmUnitId: true },
  });
  if (containingRealms.length === 0) return false;

  const realmMember = await prisma.realmMember.findFirst({
    where: {
      userId: caller.userId,
      roleKey: { in: [...REALM_AUTHORITY_ROLES] },
      realmUnitId: { in: containingRealms.map((r) => r.realmUnitId) },
    },
    select: { realmUnitId: true },
  });

  return realmMember !== null;
}
