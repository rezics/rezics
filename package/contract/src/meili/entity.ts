import type { Static } from "elysia";
import { t } from "elysia";
import { languageSchema } from "../language";

// ANCHOR: Entity Search Document

export const EntitySearchDocumentSchema = t.Object({
  /** Primary key for the Meili `entities` index — equals `Unit.id`. */
  id: t.String(),
  unitId: t.String(),
  kind: t.Union([t.String(), t.Null()]),
  verified: t.Boolean(),
  slug: t.Union([t.String(), t.Null()]),
  ownerUnitId: t.Union([t.String(), t.Null()]),

  // Searchable arrays (denormalized from UnitTranslation)
  titles: t.Array(t.String()),
  summaries: t.Array(t.String()),

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
