import {
  isExternallyGoverned,
  type LockPath,
  lockPathIntersectsPatchPath,
  type RezicsSessionClaims,
  UNIT_FIELD_LOCK_ALL,
  UnitAuthorityRoleKey,
} from "@rezics/contract";
import { and, eq, inArray } from "drizzle-orm";
import {
  RealmMember,
  UnitCollaborator,
  UnitFieldLock,
  UnitRealm,
} from "../db/schema";

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

export interface UnitAuthorityFieldLookup {
  findCollaboratorRole(unitId: string, userId: string): Promise<string | null>;
  listFieldLockPaths(unitId: string): Promise<string[]>;
}

interface UnitAuthorityRealmLookup {
  listContainingRealmIds(unitId: string): Promise<string[]>;
  hasAuthorityRealmMembership(
    userId: string,
    realmUnitIds: readonly string[],
  ): Promise<boolean>;
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleAuthorityLookup(): UnitAuthorityFieldLookup &
  UnitAuthorityRealmLookup {
  return {
    async findCollaboratorRole(unitId, userId) {
      const db = await getServerDb();
      const [collaborator] = await db
        .select({ roleKey: UnitCollaborator.roleKey })
        .from(UnitCollaborator)
        .where(
          and(
            eq(UnitCollaborator.unitId, unitId),
            eq(UnitCollaborator.userId, userId),
          ),
        )
        .limit(1);
      return collaborator?.roleKey ?? null;
    },

    async listFieldLockPaths(unitId) {
      const db = await getServerDb();
      const rows = await db
        .select({ path: UnitFieldLock.path })
        .from(UnitFieldLock)
        .where(eq(UnitFieldLock.unitId, unitId));
      return rows.map((row) => row.path);
    },

    async listContainingRealmIds(unitId) {
      const db = await getServerDb();
      const rows = await db
        .select({ realmUnitId: UnitRealm.realmUnitId })
        .from(UnitRealm)
        .where(eq(UnitRealm.unitId, unitId));
      return rows.map((row) => row.realmUnitId);
    },

    async hasAuthorityRealmMembership(userId, realmUnitIds) {
      if (realmUnitIds.length === 0) return false;
      const db = await getServerDb();
      const [member] = await db
        .select({ realmUnitId: RealmMember.realmUnitId })
        .from(RealmMember)
        .where(
          and(
            eq(RealmMember.userId, userId),
            inArray(RealmMember.roleKey, [...REALM_AUTHORITY_ROLES]),
            inArray(RealmMember.realmUnitId, [...realmUnitIds]),
          ),
        )
        .limit(1);
      return Boolean(member);
    },
  };
}

const defaultAuthorityLookup = createDrizzleAuthorityLookup();

const DEFAULT_COLLABORATOR_ROLES = [
  UnitAuthorityRoleKey.OWNER,
  UnitAuthorityRoleKey.MAINTAINER,
  UnitAuthorityRoleKey.EDITOR,
] as const;

const LOCK_BYPASS_ROLES = new Set<UnitAuthorityRoleKey>([
  UnitAuthorityRoleKey.OWNER,
  UnitAuthorityRoleKey.MAINTAINER,
]);

function isAdminRole(caller: RezicsSessionClaims): boolean {
  return (
    caller.permission.role === "ADMIN" || caller.permission.role === "ROOT"
  );
}

async function defaultVerifyAdminFromDb(userId: string): Promise<boolean> {
  const { verifyAdminFromDb } = await import("../middleware/permission");
  return verifyAdminFromDb(userId);
}

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
    lookup?: UnitAuthorityFieldLookup;
    verifyAdmin?: (userId: string) => Promise<boolean>;
  } = {},
): Promise<UnitFieldEditDecision> {
  if (!caller) {
    return denies("AUTHORITY_DENIED", "Login is required to edit this Unit.");
  }

  const verifyAdmin = options.verifyAdmin ?? defaultVerifyAdminFromDb;
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

  const lookup = options.lookup ?? defaultAuthorityLookup;
  const collaboratorRole = roleFromString(
    (await lookup.findCollaboratorRole(unit.id, caller.userId)) ?? "",
  );

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
  const locks = await lookup.listFieldLockPaths(unit.id);
  const blocked = locks
    .flatMap((lockPath) =>
      editorialPatchPaths
        .filter((patchPath) =>
          lockPathIntersectsPatchPath(lockPath as LockPath, patchPath),
        )
        .map((patchPath) => ({ lockPath, patchPath })),
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
 * Authority predicate.
 *
 * Returns true if caller is the unit owner, a system admin, or a
 * moderator+ of any Realm whose `UnitRealm` rows reference this unit.
 * Resolves with a single indexed JOIN against `UnitRealm × RealmMember`.
 *
 * Expected to resolve well under ~10 ms p99 via indexed joins on the
 * realm-membership tables; keep it index-only.
 */
export async function hasAuthorityOver(
  caller: RezicsSessionClaims | null,
  unit: AuthorityUnit,
): Promise<boolean> {
  if (!caller) return false;
  if (unit.userId && caller.userId === unit.userId) return true;

  if (isAdminRole(caller)) return true;
  if (await defaultVerifyAdminFromDb(caller.userId)) return true;

  const containingRealms = await defaultAuthorityLookup.listContainingRealmIds(
    unit.id,
  );
  if (containingRealms.length === 0) return false;

  return defaultAuthorityLookup.hasAuthorityRealmMembership(
    caller.userId,
    containingRealms,
  );
}
