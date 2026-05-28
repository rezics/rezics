import {
  type Language,
  markdownContentDoc,
  type WikiZoneConfig,
  type ZoneFilters,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { unitService } from "@/unit";

const zoneInclude = {
  unit: {
    include: {
      translations: true,
    },
  },
} satisfies Prisma.ZoneInclude;

export type ZoneWithRelations = Prisma.ZoneGetPayload<{
  include: typeof zoneInclude;
}>;

export class ZoneService {
  async getByUnitId(unitId: string): Promise<ZoneWithRelations | null> {
    return prisma.zone.findUnique({
      where: { unitId },
      include: zoneInclude,
    });
  }

  async getBySlug(slug: string): Promise<ZoneWithRelations | null> {
    const { getSlugScopeId } = await import("@/infra/slug-scopes");
    const zoneScope = getSlugScopeId("zone");
    if (!zoneScope) return null;
    const unit = await prisma.unit.findUnique({
      where: { slugScope_slug: { slugScope: zoneScope, slug } },
      select: { id: true, type: true, visibility: true },
    });

    if (!unit || unit.type !== "ZONE") return null;

    const zone = await prisma.zone.findUnique({
      where: { unitId: unit.id },
      include: zoneInclude,
    });

    return zone;
  }

  /**
   * Check lifecycle constraints.
   * Returns null if accessible, or a reason string if not.
   */
  checkLifecycle(zone: ZoneWithRelations): string | null {
    const now = new Date();

    if (zone.startsAt && now < zone.startsAt) {
      return "not_started";
    }

    if (zone.endsAt && now > zone.endsAt) {
      return "ended";
    }

    return null;
  }

  async create(input: {
    userId: string;
    slug: string;
    translations: Array<{
      language: string;
      title?: string;
      description?: string;
    }>;
    filters: ZoneFilters;
    template: string;
    styling?: Record<string, unknown> | null;
    wiki?: WikiZoneConfig | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
  }): Promise<ZoneWithRelations> {
    const unit = await unitService.create({
      userId: input.userId,
      type: "ZONE",
      status: "PUBLISHED",
      translations: input.translations.map((tr) => ({
        language: tr.language as Language,
        title: tr.title,
        description: tr.description
          ? markdownContentDoc(tr.description)
          : undefined,
      })),
    });

    await unitService.setSlug(unit.id, input.slug);

    const zone = await prisma.zone.create({
      data: {
        unitId: unit.id,
        filters: input.filters as Prisma.InputJsonValue,
        template: input.template,
        styling: (input.styling ?? null) as Prisma.InputJsonValue,
        wiki: (input.wiki ?? null) as Prisma.InputJsonValue,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
      },
      include: zoneInclude,
    });

    return zone;
  }

  async update(
    unitId: string,
    input: {
      filters?: ZoneFilters;
      template?: string;
      styling?: Record<string, unknown> | null;
      wiki?: WikiZoneConfig | null;
      startsAt?: Date | null;
      endsAt?: Date | null;
    },
  ): Promise<ZoneWithRelations> {
    const zone = await prisma.zone.update({
      where: { unitId },
      data: {
        filters:
          input.filters !== undefined
            ? (input.filters as Prisma.InputJsonValue)
            : undefined,
        template: input.template ?? undefined,
        styling:
          input.styling !== undefined
            ? (input.styling as Prisma.InputJsonValue)
            : undefined,
        wiki:
          input.wiki !== undefined
            ? (input.wiki as Prisma.InputJsonValue)
            : undefined,
        startsAt: input.startsAt !== undefined ? input.startsAt : undefined,
        endsAt: input.endsAt !== undefined ? input.endsAt : undefined,
      },
      include: zoneInclude,
    });

    return zone;
  }

  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({ where: { id: unitId } });
  }
}

export const zoneService = new ZoneService();
