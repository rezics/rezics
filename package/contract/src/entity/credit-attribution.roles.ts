import { t } from "elysia";

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

export const creditAttributionRoleKeySchema = t.Union(
  creditAttributionRoles.map((role) => t.Literal(role)) as [
    ReturnType<typeof t.Literal<CreditAttributionRole>>,
    ReturnType<typeof t.Literal<CreditAttributionRole>>,
    ...ReturnType<typeof t.Literal<CreditAttributionRole>>[],
  ],
);
