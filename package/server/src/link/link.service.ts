import type { CreateLinkInput, LinkDTO, UpdateLinkInput } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma, UnitStatus, UnitType, UnitVisibility } from "#/prisma/client";
import { mapLinkToDTO } from "./link.mapper";
import { linkInclude } from "./link.types";

export class LinkService {
  async create(input: CreateLinkInput, userId: string): Promise<LinkDTO> {
    const { url, title, description, siteName, faviconUrl, extra } = input;

    const unit = await prisma.unit.create({
      data: {
        userId,
        type: UnitType.LINK,
        status: UnitStatus.PUBLISHED,
        visibility: UnitVisibility.PUBLIC,
        defaultLanguage: "en",
        ...(title || description
          ? {
              translations: {
                create: {
                  language: "en",
                  title: title ?? url,
                  description,
                },
              },
            }
          : {}),
      },
    });

    const row = await prisma.link.create({
      data: {
        unitId: unit.id,
        url,
        siteName,
        faviconUrl,
        extra: (extra ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      include: linkInclude,
    });

    return mapLinkToDTO(row);
  }

  async getByUnitId(unitId: string): Promise<LinkDTO> {
    const row = await prisma.link.findFirstOrThrow({
      where: { unitId },
      include: linkInclude,
    });
    return mapLinkToDTO(row);
  }

  async update(unitId: string, input: UpdateLinkInput): Promise<LinkDTO> {
    const { url, title, description, siteName, faviconUrl, extra } = input;

    if (title !== undefined || description !== undefined) {
      await prisma.unitTranslation.upsert({
        where: { unitId_language: { unitId, language: "en" } },
        update: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
        },
        create: { unitId, language: "en", title, description },
      });
    }

    const row = await prisma.link.update({
      where: { unitId },
      data: {
        url: url ?? undefined,
        siteName: siteName !== undefined ? siteName : undefined,
        faviconUrl: faviconUrl !== undefined ? faviconUrl : undefined,
        extra:
          extra !== undefined
            ? ((extra ?? undefined) as Prisma.InputJsonValue | undefined)
            : undefined,
      },
      include: linkInclude,
    });

    return mapLinkToDTO(row);
  }

  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({ where: { id: unitId } });
  }
}

export const linkService = new LinkService();
