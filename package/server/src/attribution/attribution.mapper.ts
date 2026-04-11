import type {
  OrgCreditDTO,
  OrganizationDTO,
  PersonCreditDTO,
  PersonDTO,
} from "@rezics/contract";
import type { Organization, Person } from "#/prisma/client";
import type {
  OrgCreditWithRelations,
  PersonCreditWithRelations,
} from "./types";

export function mapPersonToDTO(row: Person): PersonDTO {
  return {
    id: row.id,
    name: row.name,
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    createdAt: row.createdAt?.toISOString?.() ?? (row.createdAt as any),
    updatedAt: row.updatedAt?.toISOString?.() ?? (row.updatedAt as any),
  };
}

export function mapOrganizationToDTO(row: Organization): OrganizationDTO {
  return {
    id: row.id,
    name: row.name,
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    createdAt: row.createdAt?.toISOString?.() ?? (row.createdAt as any),
    updatedAt: row.updatedAt?.toISOString?.() ?? (row.updatedAt as any),
  };
}

export function mapPersonCreditToDTO(
  row: PersonCreditWithRelations,
): PersonCreditDTO {
  return {
    unitId: row.unitId,
    personId: row.personId,
    roleKey: row.roleKey,
    sortOrder: row.sortOrder,
    person: row.person ? mapPersonToDTO(row.person) : undefined,
  };
}

export function mapOrgCreditToDTO(
  row: OrgCreditWithRelations,
): OrgCreditDTO {
  return {
    unitId: row.unitId,
    organizationId: row.organizationId,
    roleKey: row.roleKey,
    sortOrder: row.sortOrder,
    organization: row.organization
      ? mapOrganizationToDTO(row.organization)
      : undefined,
  };
}
