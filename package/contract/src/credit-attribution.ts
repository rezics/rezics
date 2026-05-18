import { t } from "elysia";
import { entityDTOSchema } from "./entity";
import { unitTranslationDTOSchema } from "./unit";

// ============================================================
// CREDIT ATTRIBUTION DTO
// ============================================================

export const creditAttributionDTOSchema = t.Object({
  unitId: t.String(),
  entityId: t.String(),
  role: t.String(),
  sortOrder: t.Number(),
  entity: t.Optional(entityDTOSchema),
});

export type CreditAttributionDTO =
  (typeof creditAttributionDTOSchema)["static"];

// ============================================================
// CREDIT ATTRIBUTION LINK/UNLINK
// ============================================================

export const linkCreditAttributionSchema = t.Object({
  unitId: t.String(),
  entityId: t.String(),
  role: t.String(),
  sortOrder: t.Optional(t.Number()),
});

export type LinkCreditAttributionInput =
  (typeof linkCreditAttributionSchema)["static"];

// ============================================================
// CREDIT ATTRIBUTION BRIEF (inline for BookDTO etc.)
// ============================================================

export const creditAttributionBriefEntitySchema = t.Object({
  unitId: t.String(),
  kind: t.Optional(t.Nullable(t.String())),
  slug: t.Optional(t.Nullable(t.String())),
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),
});

export const creditAttributionBriefSchema = t.Object({
  entityId: t.String(),
  name: t.String(),
  role: t.String(),
  sortOrder: t.Optional(t.Number()),
  entity: t.Optional(creditAttributionBriefEntitySchema),
});

export type CreditAttributionBrief =
  (typeof creditAttributionBriefSchema)["static"];

// ============================================================
// ROLE CONSTANTS
// ============================================================

export const bookCreditRoles = [
  "author",
  "co-author",
  "translator",
  "illustrator",
  "editor",
  "publisher",
  "letterer",
  "colorist",
] as const;

export const gameCreditRoles = [
  "developer",
  "publisher",
  "composer",
  "designer",
  "director",
  "producer",
  "writer",
] as const;

export const mediaCreditRoles = [
  "director",
  "producer",
  "writer",
  "composer",
  "actor",
  "narrator",
  "studio",
  "distributor",
] as const;
