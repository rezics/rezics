import type {
  AttributionDTO,
  CreateEntityInput,
  EntityDTO,
  EntityListQuery,
  LinkAttributionInput,
  UpdateEntityInput,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { patchContentCreditsToMeili } from "@/meili/content/sync";
import {
  mapAttributionToDTO,
  mapEntityToDTO,
} from "./attribution.mapper";
import { attributionInclude, entityInclude } from "./types";

export class AttributionService {
  // --- Entity CRUD ---

  async listEntities(
    options: EntityListQuery = {},
  ): Promise<{ entities: EntityDTO[]; total: number }> {
    const page = Math.max(Number(options.page ?? 1), 1);
    const limit = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skip = (page - 1) * limit;

    const where: Prisma.EntityWhereInput = {};

    if (options.kind?.trim()) {
      where.kind = options.kind;
    }

    if (options.q?.trim()) {
      where.unit = {
        translations: {
          some: {
            title: { contains: options.q, mode: "insensitive" },
          },
        },
      };
    }

    const [rows, total] = await Promise.all([
      prisma.entity.findMany({
        where,
        include: entityInclude,
        orderBy: { unit: { createdAt: "desc" } },
        skip,
        take: limit,
      }),
      prisma.entity.count({ where }),
    ]);

    return { entities: rows.map(mapEntityToDTO), total };
  }

  async getEntityById(id: string): Promise<EntityDTO> {
    const row = await prisma.entity.findUniqueOrThrow({
      where: { unitId: id },
      include: entityInclude,
    });
    return mapEntityToDTO(row);
  }

  async createEntity(req: CreateEntityInput): Promise<EntityDTO> {
    const row = await prisma.$transaction(async (tx) => {
      const unit = await tx.unit.create({
        data: {
          type: "ENTITY",
          slug: req.slug ?? undefined,
          status: "PUBLISHED",
          visibility: "PUBLIC",
          translations: {
            create: req.translations.map((tr) => ({
              language: tr.language,
              title: tr.title,
              subtitle: tr.subtitle ?? undefined,
              summary: tr.summary ?? undefined,
              description: tr.description ?? undefined,
            })),
          },
          entity: {
            create: {
              kind: req.kind ?? undefined,
              verified: false,
            },
          },
        },
      });

      return tx.entity.findUniqueOrThrow({
        where: { unitId: unit.id },
        include: entityInclude,
      });
    });

    return mapEntityToDTO(row);
  }

  async updateEntity(id: string, req: UpdateEntityInput): Promise<EntityDTO> {
    const row = await prisma.$transaction(async (tx) => {
      // Update entity extension fields
      if (req.kind !== undefined) {
        await tx.entity.update({
          where: { unitId: id },
          data: { kind: req.kind ?? undefined },
        });
      }

      // Update slug if provided
      if (req.slug !== undefined) {
        await tx.unit.update({
          where: { id },
          data: { slug: req.slug ?? undefined },
        });
      }

      // Update translations if provided
      if (req.translations?.length) {
        for (const tr of req.translations) {
          await tx.unitTranslation.upsert({
            where: { unitId_language: { unitId: id, language: tr.language } },
            create: {
              unitId: id,
              language: tr.language,
              title: tr.title,
              subtitle: tr.subtitle ?? undefined,
              summary: tr.summary ?? undefined,
              description: tr.description ?? undefined,
            },
            update: {
              title: tr.title,
              subtitle: tr.subtitle ?? undefined,
              summary: tr.summary ?? undefined,
              description: tr.description ?? undefined,
            },
          });
        }
      }

      return tx.entity.findUniqueOrThrow({
        where: { unitId: id },
        include: entityInclude,
      });
    });

    return mapEntityToDTO(row);
  }

  async deleteEntity(id: string): Promise<void> {
    await prisma.unit.delete({ where: { id } });
  }

  // --- Attribution link/unlink ---

  async linkAttribution(req: LinkAttributionInput): Promise<AttributionDTO> {
    const row = await prisma.attribution.create({
      data: {
        unitId: req.unitId,
        entityId: req.entityId,
        role: req.role,
        sortOrder: req.sortOrder ?? 0,
      },
      include: attributionInclude,
    });
    await patchContentCreditsToMeili(req.unitId);
    return mapAttributionToDTO(row);
  }

  async unlinkAttribution(
    unitId: string,
    entityId: string,
    role: string,
  ): Promise<void> {
    await prisma.attribution.delete({
      where: {
        unitId_entityId_role: { unitId, entityId, role },
      },
    });
    await patchContentCreditsToMeili(unitId);
  }

  async getAttributionsByUnit(unitId: string): Promise<AttributionDTO[]> {
    const rows = await prisma.attribution.findMany({
      where: { unitId },
      include: attributionInclude,
      orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
    });
    return rows.map(mapAttributionToDTO);
  }
}

export const attributionService = new AttributionService();
