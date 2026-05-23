import { t } from "elysia";

export const CreationMode = {
  WIKI: "wiki",
  PERSONAL: "personal",
} as const;

export type CreationMode = (typeof CreationMode)[keyof typeof CreationMode];

export const creationModeSchema = t.Union([
  t.Literal(CreationMode.WIKI),
  t.Literal(CreationMode.PERSONAL),
]);

export const UnitAuthorityRoleKey = {
  OWNER: "owner",
  MAINTAINER: "maintainer",
  EDITOR: "editor",
  VIEWER: "viewer",
} as const;

export type UnitAuthorityRoleKey =
  (typeof UnitAuthorityRoleKey)[keyof typeof UnitAuthorityRoleKey];

export const unitAuthorityRoleKeySchema = t.Union([
  t.Literal(UnitAuthorityRoleKey.OWNER),
  t.Literal(UnitAuthorityRoleKey.MAINTAINER),
  t.Literal(UnitAuthorityRoleKey.EDITOR),
  t.Literal(UnitAuthorityRoleKey.VIEWER),
]);

export const UNIT_FIELD_LOCK_ALL = "*" as const;

export type LockPath = string | typeof UNIT_FIELD_LOCK_ALL;

export const EXTERNALLY_GOVERNED_PATHS = [
  "tags",
  "realmTagApplications",
] as const;

export type ExternallyGovernedPath = (typeof EXTERNALLY_GOVERNED_PATHS)[number];

export function pathsIntersect(left: string, right: string): boolean {
  return (
    left === right ||
    left.startsWith(`${right}.`) ||
    right.startsWith(`${left}.`)
  );
}

export function lockPathIntersectsPatchPath(
  lockPath: LockPath,
  patchPath: string,
): boolean {
  return (
    lockPath === UNIT_FIELD_LOCK_ALL || pathsIntersect(lockPath, patchPath)
  );
}

export function isExternallyGoverned(path: string): boolean {
  return EXTERNALLY_GOVERNED_PATHS.some((externalPath) =>
    pathsIntersect(path, externalPath),
  );
}

export const unitFieldLockSchema = t.Object({
  unitId: t.String(),
  path: t.String(),
  lockedById: t.String(),
  reason: t.Optional(t.Nullable(t.String())),
  createdAt: t.Union([t.String(), t.Date()]),
});

export type UnitFieldLockDTO = (typeof unitFieldLockSchema)["static"];

export const unitCollaboratorSchema = t.Object({
  unitId: t.String(),
  userId: t.String(),
  roleKey: unitAuthorityRoleKeySchema,
  addedById: t.String(),
  createdAt: t.Union([t.String(), t.Date()]),
});

export type UnitCollaboratorDTO = (typeof unitCollaboratorSchema)["static"];

export const unitCollaboratorListResponseSchema = t.Object({
  collaborators: t.Array(unitCollaboratorSchema),
});

export type UnitCollaboratorListResponse =
  (typeof unitCollaboratorListResponseSchema)["static"];

export const upsertUnitCollaboratorSchema = t.Object({
  userId: t.String(),
  roleKey: unitAuthorityRoleKeySchema,
});

export type UpsertUnitCollaboratorInput =
  (typeof upsertUnitCollaboratorSchema)["static"];

export const lockedFieldRejectionSchema = t.Object({
  unitId: t.String(),
  blockedPaths: t.Array(t.String()),
  offendingLockPath: t.Optional(t.String()),
  offendingPatchPath: t.Optional(t.String()),
  locks: t.Optional(t.Array(unitFieldLockSchema)),
});

export type LockedFieldRejection =
  (typeof lockedFieldRejectionSchema)["static"];

export const unitFieldLockListResponseSchema = t.Object({
  locks: t.Array(unitFieldLockSchema),
});

export type UnitFieldLockListResponse =
  (typeof unitFieldLockListResponseSchema)["static"];

export const createUnitFieldLockSchema = t.Object({
  path: t.String(),
  reason: t.Optional(t.Nullable(t.String())),
});

export type CreateUnitFieldLockInput =
  (typeof createUnitFieldLockSchema)["static"];

export const authorityErrorCodeSchema = t.Union([
  t.Literal("AUTHORITY_DENIED"),
  t.Literal("FIELD_LOCKED"),
  t.Literal("SURFACE_NOT_COLLABORATIVE"),
  t.Literal("COLLABORATOR_ROLE_DENIED"),
]);

export const authorityErrorSchema = t.Object({
  code: authorityErrorCodeSchema,
  message: t.String(),
  unitId: t.Optional(t.String()),
  blockedPaths: t.Optional(t.Array(t.String())),
  offendingLockPath: t.Optional(t.String()),
  offendingPatchPath: t.Optional(t.String()),
  useApi: t.Optional(t.String()),
});

export type AuthorityError = (typeof authorityErrorSchema)["static"];
