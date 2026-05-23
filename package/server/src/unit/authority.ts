import {
  isExternallyGoverned,
  lockPathIntersectsPatchPath,
  UNIT_FIELD_LOCK_ALL,
  UnitAuthorityRoleKey,
  type LockPath,
  type RezicsSessionClaims,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { isAdminRole, verifyAdminFromDb } from "@/middleware";

const REALM_AUTHORITY_ROLES = ["owner", "admin", "moderator"] as const;

export interface AuthorityUnit {
  id: string;
  userId: string | null;
}

export type CollaborativeSurfacePolicy = {
  collaborative: boolean;
  collaboratorRoles?: readonly UnitAuthorityRoleKey[];
};

export type AuthorityDenyCode =
  | "AUTHORITY_DENIED"
  | "FIELD_LOCKED"
  | "SURFACE_NOT_COLLABORATIVE"
  | "COLLABORATOR_ROLE_DENIED";

export type UnitFieldEditDecision =
  | {
      allowed: true;
      reason:
        | "admin-override"
        | "primary-owner"
        | "collaborator"
        | "community-edit";
      auditOverride: boolean;
      collaboratorRole?: UnitAuthorityRoleKey;
    }
  | {
      allowed: false;
      code: AuthorityDenyCode;
      message: string;
      blockedPaths?: string[];
      offendingLockPath?: string;
      offendingPatchPath?: string;
      collaboratorRole?: UnitAuthorityRoleKey;
    };

export class UnitAuthorityError extends Error {
  readonly code: AuthorityDenyCode;
  readonly unitId?: string;
  readonly blockedPaths?: string[];
  readonly offendingLockPath?: string;
  readonly offendingPatchPath?: string;

  constructor(input: {
    code: AuthorityDenyCode;
    message: string;
    unitId?: string;
    blockedPaths?: string[];
    offendingLockPath?: string;
    offendingPatchPath?: string;
  }) {
    super(input.message);
    this.name = "UnitAuthorityError";
    this.code = input.code;
    this.unitId = input.unitId;
    this.blockedPaths = input.blockedPaths;
    this.offendingLockPath = input.offendingLockPath;
    this.offendingPatchPath = input.offendingPatchPath;
  }
}

type AuthorityPrisma = Pick<
  typeof prisma,
  "unitCollaborator" | "unitFieldLock"
>;

const DEFAULT_COLLABORATOR_ROLES = [
  UnitAuthorityRoleKey.OWNER,
  UnitAuthorityRoleKey.MAINTAINER,
  UnitAuthorityRoleKey.EDITOR,
] as const;

const LOCK_BYPASS_ROLES = new Set<UnitAuthorityRoleKey>([
  UnitAuthorityRoleKey.OWNER,
  UnitAuthorityRoleKey.MAINTAINER,
]);

function uniquePaths(paths: readonly string[]): string[] {
  return [...new Set(paths)];
}

function roleFromString(roleKey: string): UnitAuthorityRoleKey | null {
  return Object.values(UnitAuthorityRoleKey).includes(
    roleKey as UnitAuthorityRoleKey,
  )
    ? (roleKey as UnitAuthorityRoleKey)
    : null;
}

function denies(
  code: AuthorityDenyCode,
  message: string,
  extra: Pick<
    UnitFieldEditDecision & { allowed: false },
    | "blockedPaths"
    | "offendingLockPath"
    | "offendingPatchPath"
    | "collaboratorRole"
  > = {},
): UnitFieldEditDecision {
  return { allowed: false, code, message, ...extra };
}

export async function canEditUnitFields(
  caller: RezicsSessionClaims | null,
  unit: AuthorityUnit,
  patchPaths: readonly string[],
  surfacePolicy: CollaborativeSurfacePolicy,
  options: {
    prismaClient?: AuthorityPrisma;
    verifyAdmin?: (userId: string) => Promise<boolean>;
  } = {},
): Promise<UnitFieldEditDecision> {
  if (!caller) {
    return denies("AUTHORITY_DENIED", "Login is required to edit this Unit.");
  }

  const verifyAdmin = options.verifyAdmin ?? verifyAdminFromDb;
  if (isAdminRole(caller) || (await verifyAdmin(caller.userId))) {
    return {
      allowed: true,
      reason: "admin-override",
      auditOverride: true,
    };
  }

  if (unit.userId && caller.userId === unit.userId) {
    return {
      allowed: true,
      reason: "primary-owner",
      auditOverride: false,
    };
  }

  const db = options.prismaClient ?? prisma;
  const collaborator = await db.unitCollaborator.findUnique({
    where: { unitId_userId: { unitId: unit.id, userId: caller.userId } },
    select: { roleKey: true },
  });
  const collaboratorRole = collaborator
    ? roleFromString(collaborator.roleKey)
    : null;

  if (collaboratorRole) {
    const allowedRoles =
      surfacePolicy.collaboratorRoles ?? DEFAULT_COLLABORATOR_ROLES;
    if (!allowedRoles.includes(collaboratorRole)) {
      return denies(
        "COLLABORATOR_ROLE_DENIED",
        "Collaborator role is not allowed to edit this surface.",
        { collaboratorRole },
      );
    }

    if (LOCK_BYPASS_ROLES.has(collaboratorRole)) {
      return {
        allowed: true,
        reason: "collaborator",
        auditOverride: false,
        collaboratorRole,
      };
    }
  }

  if (!surfacePolicy.collaborative) {
    return denies(
      "SURFACE_NOT_COLLABORATIVE",
      "This surface is not collaborative.",
      collaboratorRole ? { collaboratorRole } : {},
    );
  }

  const editorialPatchPaths = uniquePaths(patchPaths).filter(
    (path) => !isExternallyGoverned(path),
  );
  const locks = await db.unitFieldLock.findMany({
    where: { unitId: unit.id },
    select: { path: true },
  });
  const blocked = locks
    .flatMap((lock) =>
      editorialPatchPaths
        .filter((patchPath) =>
          lockPathIntersectsPatchPath(lock.path as LockPath, patchPath),
        )
        .map((patchPath) => ({ lockPath: lock.path, patchPath })),
    )
    .at(0);

  if (blocked) {
    return denies("FIELD_LOCKED", "One or more fields are locked.", {
      blockedPaths: [blocked.lockPath],
      offendingLockPath: blocked.lockPath,
      offendingPatchPath: blocked.patchPath,
      ...(collaboratorRole ? { collaboratorRole } : {}),
    });
  }

  if (collaboratorRole) {
    return {
      allowed: true,
      reason: "collaborator",
      auditOverride: false,
      collaboratorRole,
    };
  }

  return {
    allowed: true,
    reason: "community-edit",
    auditOverride: false,
  };
}

export async function assertCanEditUnitFields(
  caller: RezicsSessionClaims | null,
  unit: AuthorityUnit,
  patchPaths: readonly string[],
  surfacePolicy: CollaborativeSurfacePolicy,
  options?: Parameters<typeof canEditUnitFields>[4],
): Promise<UnitFieldEditDecision & { allowed: true }> {
  const decision = await canEditUnitFields(
    caller,
    unit,
    patchPaths,
    surfacePolicy,
    options,
  );
  if (!decision.allowed) {
    throw new UnitAuthorityError({
      code: decision.code,
      message: decision.message,
      unitId: unit.id,
      blockedPaths: decision.blockedPaths,
      offendingLockPath: decision.offendingLockPath,
      offendingPatchPath: decision.offendingPatchPath,
    });
  }
  return decision;
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
