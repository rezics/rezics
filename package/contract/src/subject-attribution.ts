import { t } from "elysia";
import { entityDTOSchema, entityKindKeySchema } from "./entity";
import { unitDTOSchema } from "./unit";

// ============================================================
// ROLE REGISTRY
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

export const subjectAttributionRoleRegistry = {
  primary_character: {
    key: "primary_character",
    i18nKey: "attribution.subject.role.primary_character",
    entityKindHints: ["character"],
    group: "character",
  },
  featured_character: {
    key: "featured_character",
    i18nKey: "attribution.subject.role.featured_character",
    entityKindHints: ["character"],
    group: "character",
  },
  appears: {
    key: "appears",
    i18nKey: "attribution.subject.role.appears",
    entityKindHints: ["person", "character", "organization", "faction"],
    group: "appearance",
  },
  about: {
    key: "about",
    i18nKey: "attribution.subject.role.about",
    entityKindHints: ["person", "organization", "event", "concept"],
    group: "topic",
  },
  setting: {
    key: "setting",
    i18nKey: "attribution.subject.role.setting",
    entityKindHints: ["location", "faction", "event", "concept"],
    group: "setting",
  },
  source_work: {
    key: "source_work",
    i18nKey: "attribution.subject.role.source_work",
    entityKindHints: ["concept"],
    group: "source",
  },
  canonical_wiki_page: {
    key: "canonical_wiki_page",
    i18nKey: "attribution.subject.role.canonical_wiki_page",
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
    i18nKey: "attribution.subject.role.related_subject",
    entityKindHints: ["person", "organization", "character", "concept"],
    group: "related",
  },
} as const satisfies Record<
  SubjectAttributionRole,
  {
    key: SubjectAttributionRole;
    i18nKey: `attribution.subject.role.${string}`;
    entityKindHints: readonly (typeof entityKindKeySchema)["static"][];
    group:
      | "character"
      | "appearance"
      | "topic"
      | "setting"
      | "source"
      | "wiki"
      | "related";
  }
>;

export const subjectAttributionRoleKeySchema = t.Union(
  subjectAttributionRoles.map((role) => t.Literal(role)) as [
    ReturnType<typeof t.Literal<SubjectAttributionRole>>,
    ReturnType<typeof t.Literal<SubjectAttributionRole>>,
    ...ReturnType<typeof t.Literal<SubjectAttributionRole>>[],
  ],
);

// ============================================================
// SUBJECT ATTRIBUTION DTO
// ============================================================

export const subjectAttributionDTOSchema = t.Object({
  unitId: t.String(),
  entityId: t.String(),
  role: subjectAttributionRoleKeySchema,
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
  role: subjectAttributionRoleKeySchema,
  sortOrder: t.Optional(t.Number()),
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

// ============================================================
// LIST QUERIES
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
