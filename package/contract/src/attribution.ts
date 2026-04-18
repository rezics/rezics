import { t } from "elysia";
import { listGetQueryBase, listPostBodyBase } from "./list-query-base";
import { unitTranslationDTOSchema } from "./unit";

// ============================================================
// ENTITY DTO
// ============================================================

export const entityDTOSchema = t.Object({
  unitId: t.String(),
  kind: t.Optional(t.Nullable(t.String())),
  verified: t.Boolean(),
  slug: t.Optional(t.Nullable(t.String())),
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type EntityDTO = (typeof entityDTOSchema)["static"];

// ============================================================
// ENTITY CRUD
// ============================================================

export const entityParamsSchema = t.Object({
  id: t.String(),
});

export type EntityParams = (typeof entityParamsSchema)["static"];

export const createEntityTranslationSchema = t.Object({
  language: t.String(),
  title: t.String({ minLength: 1 }),
  subtitle: t.Optional(t.Nullable(t.String())),
  summary: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(t.String())),
});

export const createEntitySchema = t.Object({
  kind: t.Optional(t.Nullable(t.String())),
  slug: t.Optional(t.Nullable(t.String())),
  translations: t.Array(createEntityTranslationSchema, { minItems: 1 }),
});

export type CreateEntityInput = (typeof createEntitySchema)["static"];

export const updateEntitySchema = t.Object({
  kind: t.Optional(t.Nullable(t.String())),
  slug: t.Optional(t.Nullable(t.String())),
  translations: t.Optional(t.Array(createEntityTranslationSchema)),
});

export type UpdateEntityInput = (typeof updateEntitySchema)["static"];

export const entityListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  kind: t.Optional(t.String()),
  q: t.Optional(t.String()),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export type EntityListQuery = (typeof entityListQuerySchema)["static"];

export const entityListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  kind: t.Optional(t.String()),
  q: t.Optional(t.String()),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export type EntityListBody = (typeof entityListBodySchema)["static"];

// ============================================================
// ATTRIBUTION DTO
// ============================================================

export const attributionDTOSchema = t.Object({
  unitId: t.String(),
  entityId: t.String(),
  role: t.String(),
  sortOrder: t.Number(),
  entity: t.Optional(entityDTOSchema),
});

export type AttributionDTO = (typeof attributionDTOSchema)["static"];

// ============================================================
// ATTRIBUTION LINK/UNLINK
// ============================================================

export const linkAttributionSchema = t.Object({
  unitId: t.String(),
  entityId: t.String(),
  role: t.String(),
  sortOrder: t.Optional(t.Number()),
});

export type LinkAttributionInput = (typeof linkAttributionSchema)["static"];

// ============================================================
// ATTRIBUTION BRIEF (inline for BookDTO etc.)
// ============================================================

export const attributionBriefEntitySchema = t.Object({
  unitId: t.String(),
  kind: t.Optional(t.Nullable(t.String())),
  slug: t.Optional(t.Nullable(t.String())),
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),
});

export const attributionBriefSchema = t.Object({
  entityId: t.String(),
  name: t.String(),
  role: t.String(),
  sortOrder: t.Optional(t.Number()),
  entity: t.Optional(attributionBriefEntitySchema),
});

export type AttributionBrief = (typeof attributionBriefSchema)["static"];

// ============================================================
// ROLE CONSTANTS
// ============================================================

export const bookRoles = [
  "author",
  "co-author",
  "translator",
  "illustrator",
  "editor",
  "publisher",
  "letterer",
  "colorist",
] as const;

export const gameRoles = [
  "developer",
  "publisher",
  "composer",
  "designer",
  "director",
  "producer",
  "writer",
] as const;

export const mediaRoles = [
  "director",
  "producer",
  "writer",
  "composer",
  "actor",
  "narrator",
  "studio",
  "distributor",
] as const;

export const entityKinds = [
  "person",
  "organization",
  "circle",
  "studio",
  "label",
] as const;
