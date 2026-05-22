import type { Static } from "elysia";
import { t } from "elysia";
import { creditAttributionRoleKeySchema } from "../credit-attribution";
import { entityKindKeySchema } from "../entity";
import { languageSchema } from "../language";
import { subjectAttributionRoleKeySchema } from "../subject-attribution";

// ANCHOR: Entity Search Document

export const EntitySearchDocumentSchema = t.Object({
  /** Primary key for the Meili `entities` index — equals `Unit.id`. */
  id: t.String(),
  unitId: t.String(),
  kind: t.Union([t.String(), t.Null()]),
  verified: t.Boolean(),
  slug: t.Union([t.String(), t.Null()]),
  ownerUnitId: t.Union([t.String(), t.Null()]),
  avatar: t.Union([t.String(), t.Null()]),

  // Searchable arrays (denormalized from UnitTranslation)
  titles: t.Array(t.String()),
  summaries: t.Array(t.String()),

  // Entity-owned eligibility facets
  eligibleCreditRoles: t.Array(creditAttributionRoleKeySchema),
  eligibleSubjectRoles: t.Array(subjectAttributionRoleKeySchema),

  // Structured translations for display rendering
  translations: t.Array(
    t.Object({
      language: languageSchema,
      title: t.Union([t.String(), t.Null()]),
      subtitle: t.Union([t.String(), t.Null()]),
      summary: t.Union([t.String(), t.Null()]),
    }),
  ),

  createdAt: t.String(),
  updatedAt: t.String(),
});

export type EntitySearchDocument = Static<typeof EntitySearchDocumentSchema>;

export const EntitySearchOptionsSchema = t.Object({
  q: t.Optional(t.String()),
  kind: t.Optional(entityKindKeySchema),
  verified: t.Optional(t.Boolean()),
  ownerUnitId: t.Optional(t.String()),
  eligibleCreditRole: t.Optional(creditAttributionRoleKeySchema),
  eligibleSubjectRole: t.Optional(subjectAttributionRoleKeySchema),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export type EntitySearchOptions = Static<typeof EntitySearchOptionsSchema>;

export const EntitySearchResultSchema = t.Object({
  entities: t.Array(EntitySearchDocumentSchema),
  total: t.Number(),
  processingTimeMs: t.Number(),
  query: t.String(),
});

export type EntitySearchResult = Static<typeof EntitySearchResultSchema>;
