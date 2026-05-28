import { t } from "elysia";
import { languageSchema } from "./language";

export const workRealmContextRoleValues = [
  "official",
  "community",
  "language",
  "archive",
] as const;

export const workRealmContextRoleSchema = t.Union([
  t.Literal("official"),
  t.Literal("community"),
  t.Literal("language"),
  t.Literal("archive"),
]);

export type WorkRealmContextRole =
  (typeof workRealmContextRoleSchema)["static"];

export const workRealmContextDTOSchema = t.Object(
  {
    id: t.String(),
    workUnitId: t.String(),
    realmUnitId: t.String(),
    role: workRealmContextRoleSchema,
    priority: t.Number(),
    locale: t.Optional(t.Nullable(languageSchema)),
    releaseUnitId: t.Optional(t.Nullable(t.String())),
    createdByUserId: t.Optional(t.Nullable(t.String())),
    updatedByUserId: t.Optional(t.Nullable(t.String())),
    createdAt: t.Optional(t.Union([t.String(), t.Date()])),
    updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
  },
  { additionalProperties: false },
);

export type WorkRealmContextDTO = (typeof workRealmContextDTOSchema)["static"];

export const createWorkRealmContextSchema = t.Object(
  {
    workUnitId: t.String(),
    realmUnitId: t.String(),
    role: workRealmContextRoleSchema,
    priority: t.Optional(t.Number()),
    locale: t.Optional(t.Nullable(languageSchema)),
    releaseUnitId: t.Optional(t.Nullable(t.String())),
  },
  { additionalProperties: false },
);

export type CreateWorkRealmContextInput =
  (typeof createWorkRealmContextSchema)["static"];

export const updateWorkRealmContextSchema = t.Object(
  {
    realmUnitId: t.Optional(t.String()),
    role: t.Optional(workRealmContextRoleSchema),
    priority: t.Optional(t.Number()),
    locale: t.Optional(t.Nullable(languageSchema)),
    releaseUnitId: t.Optional(t.Nullable(t.String())),
  },
  { additionalProperties: false },
);

export type UpdateWorkRealmContextInput =
  (typeof updateWorkRealmContextSchema)["static"];

export const workRealmContextPathParamsSchema = t.Object(
  {
    contextId: t.String(),
  },
  { additionalProperties: false },
);

export type WorkRealmContextPathParams =
  (typeof workRealmContextPathParamsSchema)["static"];

export const listWorkRealmContextQuerySchema = t.Object(
  {
    workUnitId: t.Optional(t.String()),
    realmUnitId: t.Optional(t.String()),
    role: t.Optional(workRealmContextRoleSchema),
    locale: t.Optional(languageSchema),
    releaseUnitId: t.Optional(t.String()),
    limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);

export type ListWorkRealmContextQuery =
  (typeof listWorkRealmContextQuerySchema)["static"];

export const workRealmContextListResponseSchema = t.Object(
  {
    contexts: t.Array(workRealmContextDTOSchema),
  },
  { additionalProperties: false },
);

export type WorkRealmContextListResponse =
  (typeof workRealmContextListResponseSchema)["static"];

export const workRealmContextConflictSchema = t.Object(
  {
    code: t.Literal("WORK_REALM_CONTEXT_CONFLICT"),
    workUnitId: t.String(),
    role: workRealmContextRoleSchema,
    locale: t.Optional(t.Nullable(languageSchema)),
    releaseUnitId: t.Optional(t.Nullable(t.String())),
    contextIds: t.Array(t.String()),
  },
  { additionalProperties: false },
);

export type WorkRealmContextConflict =
  (typeof workRealmContextConflictSchema)["static"];

export const workRealmContextErrorSchema = t.Object(
  {
    code: t.Union([
      t.Literal("WORK_UNIT_INVALID"),
      t.Literal("REALM_UNIT_INVALID"),
      t.Literal("RELEASE_UNIT_INVALID"),
      t.Literal("WORK_REALM_CONTEXT_FORBIDDEN"),
      t.Literal("WORK_REALM_CONTEXT_CONFLICT"),
    ]),
    message: t.String(),
    conflict: t.Optional(t.Nullable(workRealmContextConflictSchema)),
  },
  { additionalProperties: false },
);

export type WorkRealmContextError =
  (typeof workRealmContextErrorSchema)["static"];

export const resolveWorkRealmContextQuerySchema = t.Object(
  {
    releaseUnitId: t.String(),
    locale: t.Optional(languageSchema),
    includeCommunity: t.Optional(t.Boolean()),
    includeArchive: t.Optional(t.Boolean()),
  },
  { additionalProperties: false },
);

export type ResolveWorkRealmContextQuery =
  (typeof resolveWorkRealmContextQuerySchema)["static"];

export const resolvedWorkRealmContextSchema = t.Object(
  {
    releaseUnitId: t.String(),
    workUnitId: t.Optional(t.Nullable(t.String())),
    official: t.Optional(t.Nullable(workRealmContextDTOSchema)),
    community: t.Array(workRealmContextDTOSchema),
    language: t.Array(workRealmContextDTOSchema),
    archive: t.Array(workRealmContextDTOSchema),
    conflicts: t.Array(workRealmContextConflictSchema),
  },
  { additionalProperties: false },
);

export type ResolvedWorkRealmContext =
  (typeof resolvedWorkRealmContextSchema)["static"];
