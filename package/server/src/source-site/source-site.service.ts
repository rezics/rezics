import type {
  CreateSourceSiteInput,
  SourceSiteListQuery,
  SourceSiteRefRule,
  UpdateSourceSiteInput,
} from "@rezics/contract";
import { isValidSourceRefRules } from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { AppError } from "@/utils/errors";
import { sourceSiteInclude } from "./source-site.types";

const SOURCE_SITE_DISPLAY_FIELDS = [
  "name",
  "logo",
  "description",
  "summary",
  "translations",
  "slug",
  "homepageUrl",
] as const;

function assertNoDisplayFields(input: Record<string, unknown>) {
  const duplicatedField = SOURCE_SITE_DISPLAY_FIELDS.find((field) =>
    Object.hasOwn(input, field),
  );
  if (duplicatedField) {
    throw new AppError(400, "SourceSite cannot write Entity display fields", {
      code: "source_site_display_field_rejected",
      details: { field: duplicatedField },
    });
  }
}

function assertValidRefRules(refRules: readonly SourceSiteRefRule[]) {
  if (!isValidSourceRefRules(refRules)) {
    throw new AppError(400, "Invalid SourceSite reference rules", {
      code: "source_site_ref_rules_invalid",
    });
  }
}

export class SourceSiteService {
  async list(query: SourceSiteListQuery = {}) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.max(1, Math.min(Number(query.limit ?? 50), 100));
    const skip = (page - 1) * limit;
    const q = query.q?.trim();

    const where = {
      ...(query.key ? { key: query.key } : {}),
      ...(query.crawlSupport ? { crawlSupport: query.crawlSupport } : {}),
      ...(query.crawlEnabled !== undefined
        ? { crawlEnabled: query.crawlEnabled }
        : {}),
      ...(q
        ? {
            OR: [
              { key: { contains: q, mode: "insensitive" as const } },
              {
                entity: {
                  unit: {
                    translations: {
                      some: {
                        title: { contains: q, mode: "insensitive" as const },
                      },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.sourceSite.findMany({
        where,
        include: sourceSiteInclude,
        orderBy: [{ key: "asc" }],
        skip,
        take: limit,
      }),
      prisma.sourceSite.count({ where }),
    ]);

    return { rows, total };
  }

  async getByEntityUnitId(entityUnitId: string) {
    return prisma.sourceSite.findUnique({
      where: { entityUnitId },
      include: sourceSiteInclude,
    });
  }

  async create(input: CreateSourceSiteInput) {
    assertNoDisplayFields(input as Record<string, unknown>);
    assertValidRefRules(input.refRules);

    await prisma.entity.findUniqueOrThrow({
      where: { unitId: input.entityUnitId },
      select: { unitId: true },
    });

    return prisma.sourceSite.create({
      data: {
        entityUnitId: input.entityUnitId,
        key: input.key,
        crawlSupport: input.crawlSupport,
        crawlEnabled: input.crawlEnabled ?? false,
        crawlerAdapterKey: input.crawlerAdapterKey ?? null,
        refRules: input.refRules as any,
      },
      include: sourceSiteInclude,
    });
  }

  async update(entityUnitId: string, input: UpdateSourceSiteInput) {
    assertNoDisplayFields(input as Record<string, unknown>);
    if (input.refRules) {
      assertValidRefRules(input.refRules);
    }

    return prisma.sourceSite.update({
      where: { entityUnitId },
      data: {
        key: input.key,
        crawlSupport: input.crawlSupport,
        crawlEnabled: input.crawlEnabled,
        crawlerAdapterKey:
          input.crawlerAdapterKey !== undefined
            ? input.crawlerAdapterKey
            : undefined,
        refRules: input.refRules as any,
      },
      include: sourceSiteInclude,
    });
  }

  async delete(entityUnitId: string) {
    await prisma.sourceSite.delete({ where: { entityUnitId } });
  }
}

export const sourceSiteService = new SourceSiteService();
