import { t } from "elysia";
import { unitDTOSchema } from "../unit/unit";
import { entityDTOSchema, type entityKindKeySchema } from "./entity";
import {
  type SubjectAttributionRole,
  subjectAttributionRoleKeySchema,
} from "./subject-attribution.roles";

export {
  type SubjectAttributionRole,
  subjectAttributionRoleKeySchema,
  subjectAttributionRoles,
} from "./subject-attribution.roles";

// ============================================================
// ROLE REGISTRY
// 角色注册表
// ============================================================

export const subjectAttributionRoleRegistry = {
  primary_character: {
    key: "primary_character",
    entityKindHints: ["character"],
    group: "character",
  },
  featured_character: {
    key: "featured_character",
    entityKindHints: ["character"],
    group: "character",
  },
  appears: {
    key: "appears",
    entityKindHints: ["person", "character", "organization", "faction"],
    group: "appearance",
  },
  about: {
    key: "about",
    entityKindHints: ["person", "organization", "event", "concept"],
    group: "topic",
  },
  setting: {
    key: "setting",
    entityKindHints: ["location", "faction", "event", "concept", "universe"],
    group: "setting",
  },
  available_on: {
    key: "available_on",
    entityKindHints: ["game_platform"],
    group: "availability",
  },
  source_work: {
    key: "source_work",
    entityKindHints: ["concept"],
    group: "source",
  },
  canonical_wiki_page: {
    key: "canonical_wiki_page",
    entityKindHints: [
      "person",
      "organization",
      "character",
      "faction",
      "location",
    ],
    group: "wiki",
  },
  related_subject: {
    key: "related_subject",
    entityKindHints: ["person", "organization", "character", "concept"],
    group: "related",
  },
} as const satisfies Record<
  SubjectAttributionRole,
  {
    key: SubjectAttributionRole;
    entityKindHints: readonly (typeof entityKindKeySchema)["static"][];
    group:
      | "character"
      | "appearance"
      | "availability"
      | "topic"
      | "setting"
      | "source"
      | "wiki"
      | "related";
  }
>;

// ============================================================
// SUBJECT ATTRIBUTION DTO
// 主题归属 DTO
// ============================================================

export const subjectAttributionDTOSchema = t.Object({
  unitId: t.String(),
  entityId: t.String(),
  role: subjectAttributionRoleKeySchema,
  position: t.String(), // Fractional Indexing
  weight: t.Optional(t.Nullable(t.Number())),
  entity: t.Optional(entityDTOSchema),
  unit: t.Optional(unitDTOSchema),
});

export type SubjectAttributionDTO =
  (typeof subjectAttributionDTOSchema)["static"];

// ============================================================
// SUBJECT ATTRIBUTION LINK/UNLINK
// 主题归属 关联/解除关联
// ============================================================

export const linkSubjectAttributionSchema = t.Object({
  unitId: t.String(),
  entityId: t.String(),
  role: subjectAttributionRoleKeySchema,
  position: t.Optional(t.String()), // Fractional Indexing
  weight: t.Optional(t.Nullable(t.Number())),
});

export type LinkSubjectAttributionInput =
  (typeof linkSubjectAttributionSchema)["static"];

export const unlinkSubjectAttributionSchema = t.Object({
  unitId: t.String(),
  entityId: t.String(),
  role: subjectAttributionRoleKeySchema,
});

export type UnlinkSubjectAttributionInput =
  (typeof unlinkSubjectAttributionSchema)["static"];

export const entityAttributionBatchSetSubjectsEntrySchema = t.Object({
  entityId: t.String(),
  position: t.Optional(t.String()), // Fractional Indexing
  weight: t.Optional(t.Nullable(t.Number())),
});

export type EntityAttributionBatchSetSubjectsEntry =
  (typeof entityAttributionBatchSetSubjectsEntrySchema)["static"];

export const entityAttributionBatchSetSubjectsOpSchema = t.Object({
  op: t.Literal("setSubjects"),
  role: subjectAttributionRoleKeySchema,
  entries: t.Array(entityAttributionBatchSetSubjectsEntrySchema),
});

export type EntityAttributionBatchSetSubjectsOp =
  (typeof entityAttributionBatchSetSubjectsOpSchema)["static"];

// ============================================================
// LIST QUERIES
// 列表查询
// ============================================================

export const subjectAttributionByUnitQuerySchema = t.Object({
  role: t.Optional(subjectAttributionRoleKeySchema),
});

export type SubjectAttributionByUnitQuery =
  (typeof subjectAttributionByUnitQuerySchema)["static"];

export const subjectAttributionBySubjectQuerySchema = t.Object({
  role: t.Optional(subjectAttributionRoleKeySchema),
  unitType: t.Optional(t.String()),
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
});

export type SubjectAttributionBySubjectQuery =
  (typeof subjectAttributionBySubjectQuerySchema)["static"];
