import { t } from "elysia";
import { entityDTOSchema } from "./entity";
import { unitTranslationDTOSchema } from "./unit";

// Re-export entity schemas for back-compat with consumers that imported them
// from "@rezics/contract" — the canonical home is `./entity`.
export {
  type CreateEntityInput,
  createEntitySchema,
  createEntityTranslationSchema,
  type EntityDTO,
  entityDTOSchema,
  type EntityKind,
  entityKinds,
  entityLegacyParamsSchema,
  type EntityLegacyParams,
  entityListBodySchema,
  type EntityListBody,
  entityListQuerySchema,
  type EntityListQuery,
  entityListResponseSchema,
  type EntityListResponse,
  entityParamsSchema,
  type EntityParams,
  type UpdateEntityInput,
  updateEntitySchema,
} from "./entity";

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
