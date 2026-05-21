import { t } from "elysia";
import { creationModeSchema } from "./content-authority";
import { listGetQueryBase, listPostBodyBase } from "./list-query-base";
import { unitTranslationDTOSchema } from "./unit";

// ============================================================
// KIND REGISTRY
// ============================================================

export const entityKinds = [
  "person",
  "organization",
  "circle",
  "studio",
  "label",
  "character",
  "faction",
  "family",
  "location",
  "artifact",
  "event",
  "concept",
] as const;

export type EntityKind = (typeof entityKinds)[number];

export const entityKindRegistry = {
  person: {
    key: "person",
    i18nKey: "entity.kind.person",
  },
  organization: {
    key: "organization",
    i18nKey: "entity.kind.organization",
  },
  circle: {
    key: "circle",
    i18nKey: "entity.kind.circle",
  },
  studio: {
    key: "studio",
    i18nKey: "entity.kind.studio",
  },
  label: {
    key: "label",
    i18nKey: "entity.kind.label",
  },
  character: {
    key: "character",
    i18nKey: "entity.kind.character",
  },
  faction: {
    key: "faction",
    i18nKey: "entity.kind.faction",
  },
  family: {
    key: "family",
    i18nKey: "entity.kind.family",
  },
  location: {
    key: "location",
    i18nKey: "entity.kind.location",
  },
  artifact: {
    key: "artifact",
    i18nKey: "entity.kind.artifact",
  },
  event: {
    key: "event",
    i18nKey: "entity.kind.event",
  },
  concept: {
    key: "concept",
    i18nKey: "entity.kind.concept",
  },
} as const satisfies Record<
  EntityKind,
  {
    key: EntityKind;
    i18nKey: `entity.kind.${string}`;
  }
>;

export const entityKindKeySchema = t.Union(
  entityKinds.map((kind) => t.Literal(kind)) as [
    ReturnType<typeof t.Literal<EntityKind>>,
    ReturnType<typeof t.Literal<EntityKind>>,
    ...ReturnType<typeof t.Literal<EntityKind>>[],
  ],
);

// ============================================================
// ENTITY DTO
// ============================================================

export const entityDTOSchema = t.Object({
  unitId: t.String(),
  kind: t.Optional(t.Nullable(entityKindKeySchema)),
  avatar: t.Optional(t.Nullable(t.String())),
  verified: t.Boolean(),
  slug: t.Optional(t.Nullable(t.String())),
  /** Owner Unit.userId (the creator's USER unitId) — exposed for /me/entities filtering. */
  ownerUnitId: t.Optional(t.Nullable(t.String())),
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type EntityDTO = (typeof entityDTOSchema)["static"];

// ============================================================
// CREATE / UPDATE / PARAMS
// ============================================================

export const entityParamsSchema = t.Object({
  unitId: t.String({ format: "uuid" }),
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
  creationMode: t.Optional(creationModeSchema),
  kind: t.Optional(t.Nullable(entityKindKeySchema)),
  avatar: t.Optional(t.Nullable(t.String())),
  /** Admin-only-after-verified — rejected for non-admin callers. */
  slug: t.Optional(t.Nullable(t.String())),
  /** Admin-only — rejected for non-admin callers. */
  verified: t.Optional(t.Boolean()),
  translations: t.Array(createEntityTranslationSchema, { minItems: 1 }),
});

export type CreateEntityInput = (typeof createEntitySchema)["static"];

export const updateEntitySchema = t.Object({
  kind: t.Optional(t.Nullable(entityKindKeySchema)),
  avatar: t.Optional(t.Nullable(t.String())),
  /** Admin-only AND only when target Entity has `verified = true`. */
  slug: t.Optional(t.Nullable(t.String())),
  /** Admin-only. */
  verified: t.Optional(t.Boolean()),
  translations: t.Optional(t.Array(createEntityTranslationSchema)),
});

export type UpdateEntityInput = (typeof updateEntitySchema)["static"];

// ============================================================
// LIST
// ============================================================

export const entityListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  kind: t.Optional(entityKindKeySchema),
  q: t.Optional(t.String()),
  /** Filter to entities owned by this USER unitId. */
  ownerUnitId: t.Optional(t.String()),
  verified: t.Optional(t.Boolean()),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export type EntityListQuery = (typeof entityListQuerySchema)["static"];

export const entityListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  kind: t.Optional(entityKindKeySchema),
  q: t.Optional(t.String()),
  ownerUnitId: t.Optional(t.String()),
  verified: t.Optional(t.Boolean()),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export type EntityListBody = (typeof entityListBodySchema)["static"];

export const entityListResponseSchema = t.Object({
  entities: t.Array(entityDTOSchema),
  total: t.Number(),
});

export type EntityListResponse = (typeof entityListResponseSchema)["static"];
