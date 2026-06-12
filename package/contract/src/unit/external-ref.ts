import { t } from "elysia";
import { listGetQueryBase, listPostBodyBase } from "../list-query-base";

export const unitExternalLinkRoleValues = [
  "official",
  "wiki",
  "store",
  "database",
  "source",
  "related",
] as const;

export type UnitExternalLinkRole = (typeof unitExternalLinkRoleValues)[number];

export const unitExternalLinkRoleSchema = t.Union([
  t.Literal("official"),
  t.Literal("wiki"),
  t.Literal("store"),
  t.Literal("database"),
  t.Literal("source"),
  t.Literal("related"),
]);

export const externalLinkDisplayEntitySummarySchema = t.Object({
  unitId: t.String(),
  name: t.String(),
  avatar: t.Optional(t.Nullable(t.String())),
  verified: t.Optional(t.Boolean()),
});

export type ExternalLinkDisplayEntitySummary =
  (typeof externalLinkDisplayEntitySummarySchema)["static"];

export const unitExternalLinkDTOSchema = t.Object({
  id: t.String(),
  unitId: t.String(),
  sourceEntityUnitId: t.String(),
  url: t.String(),
  normalizedUrl: t.Optional(t.Nullable(t.String())),
  role: unitExternalLinkRoleSchema,
  label: t.String(),
  labelUnitId: t.Optional(t.Nullable(t.String())),
  fallbackText: t.Optional(t.Nullable(t.String())),
  sourceEntity: externalLinkDisplayEntitySummarySchema,
  sortOrder: t.Number(),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type UnitExternalLinkDTO = (typeof unitExternalLinkDTOSchema)["static"];

export const createUnitExternalLinkSchema = t.Object(
  {
    unitId: t.String(),
    sourceEntityUnitId: t.String(),
    url: t.String(),
    role: t.Optional(unitExternalLinkRoleSchema),
    labelUnitId: t.Optional(t.Nullable(t.String())),
    fallbackText: t.Optional(t.Nullable(t.String())),
    sortOrder: t.Optional(t.Number()),
  },
  { additionalProperties: false },
);

export type CreateUnitExternalLinkInput =
  (typeof createUnitExternalLinkSchema)["static"];

export const updateUnitExternalLinkSchema = t.Object(
  {
    sourceEntityUnitId: t.Optional(t.String()),
    url: t.Optional(t.String()),
    role: t.Optional(unitExternalLinkRoleSchema),
    labelUnitId: t.Optional(t.Nullable(t.String())),
    fallbackText: t.Optional(t.Nullable(t.String())),
    sortOrder: t.Optional(t.Number()),
  },
  { additionalProperties: false },
);

export type UpdateUnitExternalLinkInput =
  (typeof updateUnitExternalLinkSchema)["static"];

export const unitExternalLinkParamsSchema = t.Object({
  id: t.String(),
});

export type UnitExternalLinkParams =
  (typeof unitExternalLinkParamsSchema)["static"];

export const unitExternalLinkListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  unitId: t.Optional(t.String()),
  sourceEntityUnitId: t.Optional(t.String()),
  role: t.Optional(unitExternalLinkRoleSchema),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export type UnitExternalLinkListQuery =
  (typeof unitExternalLinkListQuerySchema)["static"];

export const unitExternalLinkListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  unitId: t.Optional(t.String()),
  sourceEntityUnitId: t.Optional(t.String()),
  role: t.Optional(unitExternalLinkRoleSchema),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export type UnitExternalLinkListBody =
  (typeof unitExternalLinkListBodySchema)["static"];

export const unitExternalLinkListResponseSchema = t.Object({
  links: t.Array(unitExternalLinkDTOSchema),
  total: t.Number(),
});

export type UnitExternalLinkListResponse =
  (typeof unitExternalLinkListResponseSchema)["static"];

export const unitExternalLinksResponseSchema = t.Object({
  unitId: t.String(),
  links: t.Array(unitExternalLinkDTOSchema),
});

export type UnitExternalLinksResponse =
  (typeof unitExternalLinksResponseSchema)["static"];

export const unitExternalLinksBatchBodySchema = t.Object(
  {
    unitIds: t.Array(t.String(), { minItems: 1, maxItems: 100 }),
  },
  { additionalProperties: false },
);

export type UnitExternalLinksBatchBody =
  (typeof unitExternalLinksBatchBodySchema)["static"];

export const unitExternalLinksBatchResponseSchema = t.Object({
  byUnitId: t.Record(t.String(), unitExternalLinksResponseSchema),
});

export type UnitExternalLinksBatchResponse =
  (typeof unitExternalLinksBatchResponseSchema)["static"];
