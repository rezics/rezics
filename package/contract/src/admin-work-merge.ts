import { t } from "elysia";
import { unitWorkRoleSchema } from "./unit-work";

export const adminWorkMergeStatusValues = [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "REVERTED",
] as const;

export const adminWorkMergeStatusSchema = t.Union(
  adminWorkMergeStatusValues.map((value) => t.Literal(value)),
);

export type AdminWorkMergeStatus =
  (typeof adminWorkMergeStatusSchema)["static"];

export const adminWorkMergeOptionsSchema = t.Object({
  copyMissingTags: t.Optional(t.Boolean()),
  copyMissingAliases: t.Optional(t.Boolean()),
});

export type AdminWorkMergeOptions =
  (typeof adminWorkMergeOptionsSchema)["static"];

export const adminWorkMergeRequestSchema = t.Object({
  sourceWorkUnitId: t.String(),
  targetWorkUnitId: t.String(),
  reason: t.Optional(t.Nullable(t.String())),
  options: t.Optional(adminWorkMergeOptionsSchema),
});

export type AdminWorkMergeRequest =
  (typeof adminWorkMergeRequestSchema)["static"];

export const adminWorkMergeParamsSchema = t.Object({
  operationId: t.String(),
});

export const adminWorkMergeMembershipMoveSchema = t.Object({
  unitId: t.String(),
  role: unitWorkRoleSchema,
  fromWorkUnitId: t.String(),
  toWorkUnitId: t.String(),
  action: t.Union([t.Literal("move"), t.Literal("dedupe")]),
});

export type AdminWorkMergeMembershipMove =
  (typeof adminWorkMergeMembershipMoveSchema)["static"];

export const adminWorkMergeMetadataCopySchema = t.Object({
  tags: t.Object({
    missing: t.Array(t.String()),
    duplicates: t.Array(t.String()),
  }),
  aliases: t.Object({
    missing: t.Array(t.String()),
    duplicates: t.Array(t.String()),
  }),
});

export type AdminWorkMergeMetadataCopy =
  (typeof adminWorkMergeMetadataCopySchema)["static"];

export const adminWorkMergeRepairScopeSchema = t.Object({
  contentSearchUnitIds: t.Array(t.String()),
  postSearchUnitIds: t.Array(t.String()),
  shelfUnitIds: t.Array(t.String()),
  uswnReleaseUnitIds: t.Array(t.String()),
  contentMembershipUnitIds: t.Array(t.String()),
});

export type AdminWorkMergeRepairScope =
  (typeof adminWorkMergeRepairScopeSchema)["static"];

export const adminWorkMergePreviewSchema = t.Object({
  sourceWorkUnitId: t.String(),
  targetWorkUnitId: t.String(),
  releaseMembershipMoves: t.Array(adminWorkMergeMembershipMoveSchema),
  contentMembershipMoves: t.Array(adminWorkMergeMembershipMoveSchema),
  legacyReleaseUnitIds: t.Array(t.String()),
  metadataCopy: adminWorkMergeMetadataCopySchema,
  repairScope: adminWorkMergeRepairScopeSchema,
  affectedBehavior: t.Array(t.String()),
});

export type AdminWorkMergePreview =
  (typeof adminWorkMergePreviewSchema)["static"];

export const adminWorkMergeOperationSchema = t.Object({
  id: t.String(),
  sourceWorkUnitId: t.String(),
  targetWorkUnitId: t.String(),
  status: adminWorkMergeStatusSchema,
  actorUserId: t.String(),
  reason: t.Optional(t.Nullable(t.String())),
  copyTagsRequested: t.Boolean(),
  copyAliasesRequested: t.Boolean(),
  itemProgress: t.Record(t.String(), t.Any()),
  movedMemberships: t.Array(adminWorkMergeMembershipMoveSchema),
  movedLegacyReleaseUnitIds: t.Array(t.String()),
  createdTagKeys: t.Array(t.String()),
  createdAliasIds: t.Array(t.String()),
  repairUnitIds: t.Array(t.String()),
  repairCommandCount: t.Number(),
  errorMessage: t.Optional(t.Nullable(t.String())),
  createdAt: t.Union([t.String(), t.Date()]),
  updatedAt: t.Union([t.String(), t.Date()]),
  revertedAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  revertedByUserId: t.Optional(t.Nullable(t.String())),
});

export type AdminWorkMergeOperation =
  (typeof adminWorkMergeOperationSchema)["static"];
