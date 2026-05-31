import { t } from "elysia";

export const unitWorkRoleValues = [
  "RELEASE",
  "POST",
  "REVIEW",
  "SHELF",
  /**
   * Derived Series work-domain projection. A Series receives this role only
   * from direct release member nodes through each release's canonical
   * UnitWork(role = RELEASE); nested Series references are not expanded.
   */
  "SERIES",
  "WIKI",
  "GUIDE",
  "DERIVED",
] as const;

export const unitWorkRoleSchema = t.Union(
  unitWorkRoleValues.map((value) => t.Literal(value)),
);

export type UnitWorkRole = (typeof unitWorkRoleSchema)["static"];

export const unitWorkDisplayPolicyValues = [
  "PRIMARY",
  "SECONDARY",
  "HIDDEN_BY_DEFAULT",
] as const;

export const unitWorkDisplayPolicySchema = t.Union(
  unitWorkDisplayPolicyValues.map((value) => t.Literal(value)),
);

export type UnitWorkDisplayPolicy =
  (typeof unitWorkDisplayPolicySchema)["static"];

export const unitWorkDTOSchema = t.Object({
  unitId: t.String(),
  workUnitId: t.String(),
  role: unitWorkRoleSchema,
  language: t.Optional(t.Nullable(t.String())),
  position: t.Optional(t.Nullable(t.String())),
  displayPolicy: unitWorkDisplayPolicySchema,
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type UnitWorkDTO = (typeof unitWorkDTOSchema)["static"];

export const createUnitWorkSchema = t.Object({
  unitId: t.String(),
  workUnitId: t.String(),
  role: unitWorkRoleSchema,
  language: t.Optional(t.Nullable(t.String())),
  position: t.Optional(t.Nullable(t.String())),
  displayPolicy: t.Optional(unitWorkDisplayPolicySchema),
});

export type CreateUnitWorkInput = (typeof createUnitWorkSchema)["static"];

export const updateUnitWorkSchema = t.Object({
  language: t.Optional(t.Nullable(t.String())),
  position: t.Optional(t.Nullable(t.String())),
  displayPolicy: t.Optional(unitWorkDisplayPolicySchema),
});

export type UpdateUnitWorkInput = (typeof updateUnitWorkSchema)["static"];

export const unitWorkPathParamsSchema = t.Object({
  unitId: t.String(),
  workUnitId: t.String(),
  role: unitWorkRoleSchema,
});

export type UnitWorkPathParams = (typeof unitWorkPathParamsSchema)["static"];

export const listUnitWorkQuerySchema = t.Object({
  unitId: t.Optional(t.String()),
  workUnitId: t.Optional(t.String()),
  role: t.Optional(unitWorkRoleSchema),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
});

export type ListUnitWorkQuery = (typeof listUnitWorkQuerySchema)["static"];

export const unitWorkListResponseSchema = t.Object({
  unitWorks: t.Array(unitWorkDTOSchema),
});

export type UnitWorkListResponse =
  (typeof unitWorkListResponseSchema)["static"];

export const workDomainSearchMetadataSchema = t.Object({
  workUnitId: t.Optional(t.Nullable(t.String())),
  position: t.Optional(t.Nullable(t.String())),
  displayPolicy: t.Optional(t.Nullable(unitWorkDisplayPolicySchema)),
});

export type WorkDomainSearchMetadata =
  (typeof workDomainSearchMetadataSchema)["static"];
