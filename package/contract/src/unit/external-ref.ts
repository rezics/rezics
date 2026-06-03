import { t } from "elysia";
import { listGetQueryBase, listPostBodyBase } from "../list-query-base";
import { externalKindKeySchema } from "../source/external-kind";
import { sourceSiteDTOSchema } from "../source/site";

export const unitExternalRefDTOSchema = t.Object({
  id: t.String(),
  unitId: t.String(),
  sourceSiteEntityUnitId: t.String(),
  externalKind: externalKindKeySchema,
  externalId: t.String(),
  canonicalUrl: t.String(),
  originalUrl: t.Optional(t.Nullable(t.String())),
  firstSeenAt: t.Union([t.String(), t.Date()]),
  lastSeenAt: t.Union([t.String(), t.Date()]),
  sourceSite: t.Optional(sourceSiteDTOSchema),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type UnitExternalRefDTO = (typeof unitExternalRefDTOSchema)["static"];

export const createUnitExternalRefSchema = t.Object(
  {
    unitId: t.String(),
    sourceSiteEntityUnitId: t.String(),
    externalKind: t.Optional(externalKindKeySchema),
    externalId: t.Optional(t.String({ minLength: 1 })),
    originalUrl: t.Optional(t.Nullable(t.String())),
    observedUrl: t.Optional(t.String()),
    firstSeenAt: t.Optional(t.Union([t.String(), t.Date()])),
    lastSeenAt: t.Optional(t.Union([t.String(), t.Date()])),
  },
  { additionalProperties: false },
);

export type CreateUnitExternalRefInput =
  (typeof createUnitExternalRefSchema)["static"];

export const updateUnitExternalRefSchema = t.Object(
  {
    externalKind: t.Optional(externalKindKeySchema),
    externalId: t.Optional(t.String({ minLength: 1 })),
    originalUrl: t.Optional(t.Nullable(t.String())),
    observedUrl: t.Optional(t.String()),
    firstSeenAt: t.Optional(t.Union([t.String(), t.Date()])),
    lastSeenAt: t.Optional(t.Union([t.String(), t.Date()])),
  },
  { additionalProperties: false },
);

export type UpdateUnitExternalRefInput =
  (typeof updateUnitExternalRefSchema)["static"];

export const unitExternalRefParamsSchema = t.Object({
  id: t.String(),
});

export type UnitExternalRefParams =
  (typeof unitExternalRefParamsSchema)["static"];

export const unitExternalRefListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  unitId: t.Optional(t.String()),
  sourceSiteEntityUnitId: t.Optional(t.String()),
  externalKind: t.Optional(externalKindKeySchema),
  externalId: t.Optional(t.String()),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export type UnitExternalRefListQuery =
  (typeof unitExternalRefListQuerySchema)["static"];

export const unitExternalRefListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  unitId: t.Optional(t.String()),
  sourceSiteEntityUnitId: t.Optional(t.String()),
  externalKind: t.Optional(externalKindKeySchema),
  externalId: t.Optional(t.String()),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export type UnitExternalRefListBody =
  (typeof unitExternalRefListBodySchema)["static"];

export const unitExternalRefListResponseSchema = t.Object({
  refs: t.Array(unitExternalRefDTOSchema),
  total: t.Number(),
});

export type UnitExternalRefListResponse =
  (typeof unitExternalRefListResponseSchema)["static"];

export const parseUnitExternalRefUrlSchema = t.Object(
  {
    sourceSiteEntityUnitId: t.String(),
    url: t.String(),
  },
  { additionalProperties: false },
);

export type ParseUnitExternalRefUrlInput =
  (typeof parseUnitExternalRefUrlSchema)["static"];

export const parsedUnitExternalRefUrlSchema = t.Object({
  externalKind: externalKindKeySchema,
  externalId: t.String(),
});

export type ParsedUnitExternalRefUrl =
  (typeof parsedUnitExternalRefUrlSchema)["static"];
