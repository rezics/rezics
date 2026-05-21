import { t } from "elysia";
import { entityDTOSchema, entityKindKeySchema } from "./entity";
import { unitTranslationDTOSchema, unitTypeSchema } from "./unit";

// ============================================================
// ROLE REGISTRY
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

export const creditAttributionRoles = [
  "author",
  "co-author",
  "translator",
  "illustrator",
  "editor",
  "publisher",
  "letterer",
  "colorist",
  "developer",
  "composer",
  "designer",
  "director",
  "producer",
  "writer",
  "actor",
  "narrator",
  "studio",
  "distributor",
] as const;

export type CreditAttributionRole = (typeof creditAttributionRoles)[number];

export const creditAttributionRoleRegistry = {
  author: {
    key: "author",
    i18nKey: "attribution.credit.role.author",
    appliesToUnitTypes: ["BOOK"],
    entityKindHints: ["person", "organization"],
    prominence: "metadata",
  },
  "co-author": {
    key: "co-author",
    i18nKey: "attribution.credit.role.co_author",
    appliesToUnitTypes: ["BOOK"],
    entityKindHints: ["person", "organization"],
    prominence: "metadata",
  },
  translator: {
    key: "translator",
    i18nKey: "attribution.credit.role.translator",
    appliesToUnitTypes: ["BOOK"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  illustrator: {
    key: "illustrator",
    i18nKey: "attribution.credit.role.illustrator",
    appliesToUnitTypes: ["BOOK"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  editor: {
    key: "editor",
    i18nKey: "attribution.credit.role.editor",
    appliesToUnitTypes: ["BOOK"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  publisher: {
    key: "publisher",
    i18nKey: "attribution.credit.role.publisher",
    appliesToUnitTypes: ["BOOK", "GAME"],
    entityKindHints: ["organization", "label"],
    prominence: "credits",
  },
  letterer: {
    key: "letterer",
    i18nKey: "attribution.credit.role.letterer",
    appliesToUnitTypes: ["BOOK"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  colorist: {
    key: "colorist",
    i18nKey: "attribution.credit.role.colorist",
    appliesToUnitTypes: ["BOOK"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  developer: {
    key: "developer",
    i18nKey: "attribution.credit.role.developer",
    appliesToUnitTypes: ["GAME"],
    entityKindHints: ["organization", "studio", "person"],
    prominence: "credits",
  },
  composer: {
    key: "composer",
    i18nKey: "attribution.credit.role.composer",
    appliesToUnitTypes: ["GAME", "MEDIA"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  designer: {
    key: "designer",
    i18nKey: "attribution.credit.role.designer",
    appliesToUnitTypes: ["GAME"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  director: {
    key: "director",
    i18nKey: "attribution.credit.role.director",
    appliesToUnitTypes: ["GAME", "MEDIA"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  producer: {
    key: "producer",
    i18nKey: "attribution.credit.role.producer",
    appliesToUnitTypes: ["GAME", "MEDIA"],
    entityKindHints: ["person", "organization", "studio"],
    prominence: "credits",
  },
  writer: {
    key: "writer",
    i18nKey: "attribution.credit.role.writer",
    appliesToUnitTypes: ["GAME", "MEDIA"],
    entityKindHints: ["person", "organization"],
    prominence: "credits",
  },
  actor: {
    key: "actor",
    i18nKey: "attribution.credit.role.actor",
    appliesToUnitTypes: ["MEDIA"],
    entityKindHints: ["person"],
    prominence: "credits",
  },
  narrator: {
    key: "narrator",
    i18nKey: "attribution.credit.role.narrator",
    appliesToUnitTypes: ["MEDIA"],
    entityKindHints: ["person"],
    prominence: "credits",
  },
  studio: {
    key: "studio",
    i18nKey: "attribution.credit.role.studio",
    appliesToUnitTypes: ["MEDIA"],
    entityKindHints: ["studio", "organization"],
    prominence: "credits",
  },
  distributor: {
    key: "distributor",
    i18nKey: "attribution.credit.role.distributor",
    appliesToUnitTypes: ["MEDIA"],
    entityKindHints: ["organization"],
    prominence: "credits",
  },
} as const satisfies Record<
  CreditAttributionRole,
  {
    key: CreditAttributionRole;
    i18nKey: `attribution.credit.role.${string}`;
    appliesToUnitTypes: readonly (typeof unitTypeSchema)["static"][];
    entityKindHints: readonly (typeof entityKindKeySchema)["static"][];
    prominence: "metadata" | "credits";
  }
>;

export const creditAttributionRoleKeySchema = t.Union(
  creditAttributionRoles.map((role) => t.Literal(role)) as [
    ReturnType<typeof t.Literal<CreditAttributionRole>>,
    ReturnType<typeof t.Literal<CreditAttributionRole>>,
    ...ReturnType<typeof t.Literal<CreditAttributionRole>>[],
  ],
);

// ============================================================
// CREDIT ATTRIBUTION DTO
// ============================================================

export const creditAttributionDTOSchema = t.Object({
  unitId: t.String(),
  entityId: t.String(),
  role: creditAttributionRoleKeySchema,
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
  role: creditAttributionRoleKeySchema,
  sortOrder: t.Optional(t.Number()),
});

export type LinkCreditAttributionInput =
  (typeof linkCreditAttributionSchema)["static"];

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
});

export type CreditAttributionBrief =
  (typeof creditAttributionBriefSchema)["static"];
