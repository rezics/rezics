import type { Prisma } from "#/prisma/client";

// Internal person type with relations
export type PersonWithRelations = Prisma.PersonGetPayload<{
  include: typeof personInclude;
}>;

// Prisma include for person relations
export const personInclude = {
  credits: true,
} satisfies Prisma.PersonInclude;

// Internal organization type with relations
export type OrganizationWithRelations = Prisma.OrganizationGetPayload<{
  include: typeof organizationInclude;
}>;

// Prisma include for organization relations
export const organizationInclude = {
  credits: true,
} satisfies Prisma.OrganizationInclude;

// Person credit with person relation
export type PersonCreditWithRelations = Prisma.PersonCreditGetPayload<{
  include: typeof personCreditInclude;
}>;

export const personCreditInclude = {
  person: true,
} satisfies Prisma.PersonCreditInclude;

// Org credit with organization relation
export type OrgCreditWithRelations = Prisma.OrgCreditGetPayload<{
  include: typeof orgCreditInclude;
}>;

export const orgCreditInclude = {
  organization: true,
} satisfies Prisma.OrgCreditInclude;
