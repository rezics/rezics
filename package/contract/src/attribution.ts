import { t } from "elysia";

// ============================================================
// PERSON DTO
// ============================================================

export const personDTOSchema = t.Object({
  id: t.String(),
  name: t.String(),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type PersonDTO = (typeof personDTOSchema)["static"];

// ============================================================
// ORGANIZATION DTO
// ============================================================

export const organizationDTOSchema = t.Object({
  id: t.String(),
  name: t.String(),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type OrganizationDTO = (typeof organizationDTOSchema)["static"];

// ============================================================
// PERSON CREDIT DTO
// ============================================================

export const personCreditDTOSchema = t.Object({
  unitId: t.String(),
  personId: t.String(),
  roleKey: t.String(),
  sortOrder: t.Number(),
  person: t.Optional(personDTOSchema),
});

export type PersonCreditDTO = (typeof personCreditDTOSchema)["static"];

// ============================================================
// ORG CREDIT DTO
// ============================================================

export const orgCreditDTOSchema = t.Object({
  unitId: t.String(),
  organizationId: t.String(),
  roleKey: t.String(),
  sortOrder: t.Number(),
  organization: t.Optional(organizationDTOSchema),
});

export type OrgCreditDTO = (typeof orgCreditDTOSchema)["static"];

// ============================================================
// PERSON CRUD
// ============================================================

export const personParamsSchema = t.Object({
  id: t.String(),
});

export type PersonParams = (typeof personParamsSchema)["static"];

export const createPersonSchema = t.Object({
  name: t.String({ minLength: 1 }),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type CreatePersonInput = (typeof createPersonSchema)["static"];

export const updatePersonSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type UpdatePersonInput = (typeof updatePersonSchema)["static"];

// ============================================================
// ORGANIZATION CRUD
// ============================================================

export const organizationParamsSchema = t.Object({
  id: t.String(),
});

export type OrganizationParams = (typeof organizationParamsSchema)["static"];

export const createOrganizationSchema = t.Object({
  name: t.String({ minLength: 1 }),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type CreateOrganizationInput =
  (typeof createOrganizationSchema)["static"];

export const updateOrganizationSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type UpdateOrganizationInput =
  (typeof updateOrganizationSchema)["static"];

// ============================================================
// CREDIT LINK/UNLINK
// ============================================================

export const linkPersonCreditSchema = t.Object({
  unitId: t.String(),
  personId: t.String(),
  roleKey: t.String(),
  sortOrder: t.Optional(t.Number()),
});

export type LinkPersonCreditInput =
  (typeof linkPersonCreditSchema)["static"];

export const linkOrgCreditSchema = t.Object({
  unitId: t.String(),
  organizationId: t.String(),
  roleKey: t.String(),
  sortOrder: t.Optional(t.Number()),
});

export type LinkOrgCreditInput = (typeof linkOrgCreditSchema)["static"];

export const personListQuerySchema = t.Object({
  q: t.Optional(t.String()),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export type PersonListQuery = (typeof personListQuerySchema)["static"];

export const organizationListQuerySchema = t.Object({
  q: t.Optional(t.String()),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export type OrganizationListQuery =
  (typeof organizationListQuerySchema)["static"];
