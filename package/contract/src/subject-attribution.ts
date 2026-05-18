import { t } from "elysia";
import { entityDTOSchema } from "./entity";
import { unitDTOSchema } from "./unit";

// ============================================================
// SUBJECT ATTRIBUTION DTO
// ============================================================

export const subjectAttributionDTOSchema = t.Object({
  unitId: t.String(),
  entityId: t.String(),
  role: t.String(),
  sortOrder: t.Number(),
  weight: t.Optional(t.Nullable(t.Number())),
  entity: t.Optional(entityDTOSchema),
  unit: t.Optional(unitDTOSchema),
});

export type SubjectAttributionDTO =
  (typeof subjectAttributionDTOSchema)["static"];

// ============================================================
// SUBJECT ATTRIBUTION LINK/UNLINK
// ============================================================

export const linkSubjectAttributionSchema = t.Object({
  unitId: t.String(),
  entityId: t.String(),
  role: t.String({ maxLength: 64 }),
  sortOrder: t.Optional(t.Number()),
  weight: t.Optional(t.Nullable(t.Number())),
});

export type LinkSubjectAttributionInput =
  (typeof linkSubjectAttributionSchema)["static"];

export const unlinkSubjectAttributionSchema = t.Object({
  unitId: t.String(),
  entityId: t.String(),
  role: t.String(),
});

export type UnlinkSubjectAttributionInput =
  (typeof unlinkSubjectAttributionSchema)["static"];

// ============================================================
// LIST QUERIES
// ============================================================

export const subjectAttributionByUnitQuerySchema = t.Object({
  role: t.Optional(t.String()),
});

export type SubjectAttributionByUnitQuery =
  (typeof subjectAttributionByUnitQuerySchema)["static"];

export const subjectAttributionBySubjectQuerySchema = t.Object({
  role: t.Optional(t.String()),
  unitType: t.Optional(t.String()),
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
});

export type SubjectAttributionBySubjectQuery =
  (typeof subjectAttributionBySubjectQuerySchema)["static"];

// ============================================================
// ROLE CONSTANTS
// ============================================================

export const subjectAttributionRoles = [
  "primary_character",
  "featured_character",
  "appears",
  "about",
  "setting",
  "source_work",
  "canonical_wiki_page",
  "related_subject",
] as const;

export type SubjectAttributionRole = (typeof subjectAttributionRoles)[number];
