import { t } from "elysia";
import {
  type CreditAttributionRole,
  creditAttributionRoleKeySchema,
} from "./credit-attribution.roles";
import { entityDTOSchema, entityKindKeySchema } from "./entity";
import { externalKindKeySchema } from "./external-kind";
import { unitTranslationDTOSchema, type unitTypeSchema } from "./unit";

export {
  bookCreditRoles,
  type CreditAttributionRole,
  creditAttributionRoleKeySchema,
  creditAttributionRoles,
  gameCreditRoles,
  mediaCreditRoles,
} from "./credit-attribution.roles";

// ============================================================
// ROLE REGISTRY
// ============================================================

export const creditAttributionRoleRegistry = {
  author: {
    key: "author",
    appliesToUnitTypes: ["BOOK"],
    entityKindHints: ["person", "organization"],
    prominence: "metadata",
  },
  "co-author": {
    key: "co-author",
    appliesToUnitTypes: ["BOOK"],
    entityKindHints: ["person", "organization"],
    prominence: "metadata",
  },
  translator: {
    key: "translator",
    appliesToUnitTypes: ["BOOK"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  illustrator: {
    key: "illustrator",
    appliesToUnitTypes: ["BOOK"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  editor: {
    key: "editor",
    appliesToUnitTypes: ["BOOK"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  publisher: {
    key: "publisher",
    appliesToUnitTypes: ["BOOK", "GAME"],
    entityKindHints: ["organization", "label"],
    prominence: "credits",
  },
  letterer: {
    key: "letterer",
    appliesToUnitTypes: ["BOOK"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  colorist: {
    key: "colorist",
    appliesToUnitTypes: ["BOOK"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  developer: {
    key: "developer",
    appliesToUnitTypes: ["GAME"],
    entityKindHints: ["organization", "studio", "person"],
    prominence: "credits",
  },
  composer: {
    key: "composer",
    appliesToUnitTypes: ["GAME", "MEDIA"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  designer: {
    key: "designer",
    appliesToUnitTypes: ["GAME"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  director: {
    key: "director",
    appliesToUnitTypes: ["GAME", "MEDIA"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  producer: {
    key: "producer",
    appliesToUnitTypes: ["GAME", "MEDIA"],
    entityKindHints: ["person", "organization", "studio"],
    prominence: "credits",
  },
  writer: {
    key: "writer",
    appliesToUnitTypes: ["GAME", "MEDIA"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  actor: {
    key: "actor",
    appliesToUnitTypes: ["MEDIA"],
    entityKindHints: ["person"],
    prominence: "credits",
  },
  narrator: {
    key: "narrator",
    appliesToUnitTypes: ["MEDIA"],
    entityKindHints: ["person"],
    prominence: "credits",
  },
  studio: {
    key: "studio",
    appliesToUnitTypes: ["MEDIA"],
    entityKindHints: ["studio", "organization"],
    prominence: "credits",
  },
  distributor: {
    key: "distributor",
    appliesToUnitTypes: ["MEDIA"],
    entityKindHints: ["organization"],
    prominence: "credits",
  },
} as const satisfies Record<
  CreditAttributionRole,
  {
    key: CreditAttributionRole;
    appliesToUnitTypes: readonly (typeof unitTypeSchema)["static"][];
    entityKindHints: readonly (typeof entityKindKeySchema)["static"][];
    prominence: "metadata" | "credits";
  }
>;

// ============================================================
// CREDIT ATTRIBUTION DTO
// ============================================================

export const creditAttributionEvidenceSourceSiteSummarySchema = t.Object({
  entityUnitId: t.String(),
  key: t.String(),
  entity: t.Optional(entityDTOSchema),
});

export const creditAttributionEvidenceSummarySchema = t.Object({
  id: t.String(),
  unitId: t.String(),
  entityId: t.String(),
  role: creditAttributionRoleKeySchema,
  sourceRefId: t.String(),
  sourceSiteEntityUnitId: t.String(),
  externalKind: externalKindKeySchema,
  externalId: t.String(),
  canonicalUrl: t.String(),
  originalUrl: t.Optional(t.Nullable(t.String())),
  claimPath: t.Optional(t.Nullable(t.String())),
  observedUrl: t.Optional(t.Nullable(t.String())),
  observedAt: t.Union([t.String(), t.Date()]),
  confidence: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 1 }))),
  sourceSite: t.Optional(creditAttributionEvidenceSourceSiteSummarySchema),
});

export type CreditAttributionEvidenceSummary =
  (typeof creditAttributionEvidenceSummarySchema)["static"];

export const createCreditAttributionEvidenceSchema = t.Object(
  {
    unitId: t.String(),
    entityId: t.String(),
    role: creditAttributionRoleKeySchema,
    sourceRefId: t.String(),
    claimPath: t.Optional(t.Nullable(t.String())),
    observedUrl: t.Optional(t.Nullable(t.String())),
    observedAt: t.Optional(t.Union([t.String(), t.Date()])),
    confidence: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 1 }))),
  },
  { additionalProperties: false },
);

export type CreateCreditAttributionEvidenceInput =
  (typeof createCreditAttributionEvidenceSchema)["static"];

export const updateCreditAttributionEvidenceSchema = t.Object(
  {
    sourceRefId: t.Optional(t.String()),
    claimPath: t.Optional(t.Nullable(t.String())),
    observedUrl: t.Optional(t.Nullable(t.String())),
    observedAt: t.Optional(t.Union([t.String(), t.Date()])),
    confidence: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 1 }))),
  },
  { additionalProperties: false },
);

export type UpdateCreditAttributionEvidenceInput =
  (typeof updateCreditAttributionEvidenceSchema)["static"];

export const creditAttributionDTOSchema = t.Object({
  unitId: t.String(),
  entityId: t.String(),
  role: creditAttributionRoleKeySchema,
  sortOrder: t.Number(),
  entity: t.Optional(entityDTOSchema),
  evidence: t.Optional(t.Array(creditAttributionEvidenceSummarySchema)),
});

export type CreditAttributionDTO =
  (typeof creditAttributionDTOSchema)["static"];

// ============================================================
// CREDIT ATTRIBUTION LINK/UNLINK
// ============================================================

export const linkCreditAttributionSchema = t.Object({
  unitId: t.String(),
  entityId: t.String(),
  role: creditAttributionRoleKeySchema,
  sortOrder: t.Optional(t.Number()),
});

export type LinkCreditAttributionInput =
  (typeof linkCreditAttributionSchema)["static"];

export const entityAttributionBatchSetCreditsEntrySchema = t.Object({
  entityId: t.String(),
  sortOrder: t.Optional(t.Number()),
});

export type EntityAttributionBatchSetCreditsEntry =
  (typeof entityAttributionBatchSetCreditsEntrySchema)["static"];

export const entityAttributionBatchSetCreditsOpSchema = t.Object({
  op: t.Literal("setCredits"),
  role: creditAttributionRoleKeySchema,
  entries: t.Array(entityAttributionBatchSetCreditsEntrySchema),
});

export type EntityAttributionBatchSetCreditsOp =
  (typeof entityAttributionBatchSetCreditsOpSchema)["static"];

// ============================================================
// CREDIT ATTRIBUTION BRIEF (inline for BookDTO etc.)
// ============================================================

export const creditAttributionBriefEntitySchema = t.Object({
  unitId: t.String(),
  kind: t.Optional(t.Nullable(entityKindKeySchema)),
  avatar: t.Optional(t.Nullable(t.String())),
  slug: t.Optional(t.Nullable(t.String())),
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),
});

export const creditAttributionBriefSchema = t.Object({
  entityId: t.String(),
  name: t.String(),
  role: creditAttributionRoleKeySchema,
  sortOrder: t.Optional(t.Number()),
  entity: t.Optional(creditAttributionBriefEntitySchema),
  evidence: t.Optional(t.Array(creditAttributionEvidenceSummarySchema)),
});

export type CreditAttributionBrief =
  (typeof creditAttributionBriefSchema)["static"];
