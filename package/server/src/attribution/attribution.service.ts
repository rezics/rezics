import type {
  CreateOrganizationInput,
  CreatePersonInput,
  LinkOrgCreditInput,
  LinkPersonCreditInput,
  OrgCreditDTO,
  OrganizationDTO,
  OrganizationListQuery,
  PersonCreditDTO,
  PersonDTO,
  PersonListQuery,
  UpdateOrganizationInput,
  UpdatePersonInput,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import {
  mapOrgCreditToDTO,
  mapOrganizationToDTO,
  mapPersonCreditToDTO,
  mapPersonToDTO,
} from "./attribution.mapper";
import { orgCreditInclude, personCreditInclude } from "./types";

export class AttributionService {
  // --- Person CRUD ---

  async listPersons(
    options: PersonListQuery = {},
  ): Promise<{ persons: PersonDTO[]; total: number }> {
    const page = Math.max(Number(options.page ?? 1), 1);
    const limit = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skip = (page - 1) * limit;

    const where: Prisma.PersonWhereInput = options.q?.trim()
      ? { name: { contains: options.q, mode: "insensitive" } }
      : {};

    const [rows, total] = await Promise.all([
      prisma.person.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.person.count({ where }),
    ]);

    return { persons: rows.map(mapPersonToDTO), total };
  }

  async getPersonById(id: string): Promise<PersonDTO> {
    const row = await prisma.person.findUniqueOrThrow({ where: { id } });
    return mapPersonToDTO(row);
  }

  async createPerson(req: CreatePersonInput): Promise<PersonDTO> {
    const row = await prisma.person.create({
      data: {
        name: req.name,
        extra: (req.extra ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    return mapPersonToDTO(row);
  }

  async updatePerson(id: string, req: UpdatePersonInput): Promise<PersonDTO> {
    const row = await prisma.person.update({
      where: { id },
      data: {
        name: req.name ?? undefined,
        extra: req.extra !== undefined
          ? ((req.extra ?? undefined) as Prisma.InputJsonValue | undefined)
          : undefined,
      },
    });
    return mapPersonToDTO(row);
  }

  async deletePerson(id: string): Promise<void> {
    await prisma.person.delete({ where: { id } });
  }

  // --- Organization CRUD ---

  async listOrganizations(
    options: OrganizationListQuery = {},
  ): Promise<{ organizations: OrganizationDTO[]; total: number }> {
    const page = Math.max(Number(options.page ?? 1), 1);
    const limit = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skip = (page - 1) * limit;

    const where: Prisma.OrganizationWhereInput = options.q?.trim()
      ? { name: { contains: options.q, mode: "insensitive" } }
      : {};

    const [rows, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.organization.count({ where }),
    ]);

    return { organizations: rows.map(mapOrganizationToDTO), total };
  }

  async getOrganizationById(id: string): Promise<OrganizationDTO> {
    const row = await prisma.organization.findUniqueOrThrow({
      where: { id },
    });
    return mapOrganizationToDTO(row);
  }

  async createOrganization(
    req: CreateOrganizationInput,
  ): Promise<OrganizationDTO> {
    const row = await prisma.organization.create({
      data: {
        name: req.name,
        extra: (req.extra ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    return mapOrganizationToDTO(row);
  }

  async updateOrganization(
    id: string,
    req: UpdateOrganizationInput,
  ): Promise<OrganizationDTO> {
    const row = await prisma.organization.update({
      where: { id },
      data: {
        name: req.name ?? undefined,
        extra: req.extra !== undefined
          ? ((req.extra ?? undefined) as Prisma.InputJsonValue | undefined)
          : undefined,
      },
    });
    return mapOrganizationToDTO(row);
  }

  async deleteOrganization(id: string): Promise<void> {
    await prisma.organization.delete({ where: { id } });
  }

  // --- Person credit links ---

  async linkPersonCredit(
    req: LinkPersonCreditInput,
  ): Promise<PersonCreditDTO> {
    const row = await prisma.personCredit.create({
      data: {
        unitId: req.unitId,
        personId: req.personId,
        roleKey: req.roleKey,
        sortOrder: req.sortOrder ?? 0,
      },
      include: personCreditInclude,
    });
    return mapPersonCreditToDTO(row);
  }

  async unlinkPersonCredit(
    unitId: string,
    personId: string,
    roleKey: string,
  ): Promise<void> {
    await prisma.personCredit.delete({
      where: {
        unitId_personId_roleKey: { unitId, personId, roleKey },
      },
    });
  }

  // --- Org credit links ---

  async linkOrgCredit(req: LinkOrgCreditInput): Promise<OrgCreditDTO> {
    const row = await prisma.orgCredit.create({
      data: {
        unitId: req.unitId,
        organizationId: req.organizationId,
        roleKey: req.roleKey,
        sortOrder: req.sortOrder ?? 0,
      },
      include: orgCreditInclude,
    });
    return mapOrgCreditToDTO(row);
  }

  async unlinkOrgCredit(
    unitId: string,
    organizationId: string,
    roleKey: string,
  ): Promise<void> {
    await prisma.orgCredit.delete({
      where: {
        unitId_organizationId_roleKey: { unitId, organizationId, roleKey },
      },
    });
  }
}

export const attributionService = new AttributionService();
