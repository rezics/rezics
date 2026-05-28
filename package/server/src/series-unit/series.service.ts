import type {
  ContentStructureItem,
  CreateSeriesInput,
  Language,
  RepresentativeReleaseSelection,
  SeriesContentIndexDTO,
  SeriesDiagnosticsDTO,
  SeriesDetailDTO,
  SeriesListQuery,
  UpdateSeriesInput,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import type { Prisma } from "#/prisma/client";
import {
  type ContentRating,
  prisma,
  UnitStatus,
  UnitType,
  UnitVisibility,
  UnitWorkDisplayPolicy,
  UnitWorkRole,
} from "#/prisma/client";
import { contentStructureService } from "@/content-structure";
import { nullableContentDocJson } from "@/content-doc/prisma-json";
import { pickSlugScope } from "@/infra/slug-scopes";
import { serverJobProducer } from "@/job/job-boundary";
import { assertLicenseSlug } from "@/unit/publication-policy";
import { assertUnitTranslationExtraAllowed } from "@/unit/translation-extra";
import { AppError } from "@/utils/errors";
import { mapSeriesContentIndexToDTO, mapSeriesToDTO } from "./series.mapper";
import {
  seriesInclude,
  seriesOrderBy,
  type SeriesWithRelations,
} from "./series.types";

const RELEASE_ROLE = UnitWorkRole.RELEASE;
const SERIES_ROLE = UnitWorkRole.SERIES;
const RELEASE_UNIT_TYPES = [UnitType.BOOK, UnitType.GAME, UnitType.MEDIA];
const RELEASE_UNIT_TYPE_SET: ReadonlySet<UnitType> = new Set(
  RELEASE_UNIT_TYPES,
);

type Tx = Prisma.TransactionClient;

function flattenContentNodes(
  nodes: readonly ContentStructureItem[],
): ContentStructureItem[] {
  const out: ContentStructureItem[] = [];
  for (const node of nodes) {
    out.push(node);
    if (node.children?.length) out.push(...flattenContentNodes(node.children));
  }
  return out;
}

async function enqueueSeriesProjectionSync(
  seriesUnitId: string,
  workUnitIds: readonly string[],
): Promise<void> {
  const source = { type: "server" as const, service: "series" };
  await Promise.all([
    serverJobProducer.enqueue(
      createSearchCommand(
        SEARCH_COMMAND_KINDS.contentSync,
        { unitId: seriesUnitId },
        source,
      ),
    ),
    ...workUnitIds.map((workUnitId) =>
      serverJobProducer.enqueue(
        createSearchCommand(
          SEARCH_COMMAND_KINDS.contentSyncWorkReleases,
          { targetId: workUnitId },
          source,
        ),
      ),
    ),
  ]);
}

export class SeriesService {
  async list(
    query: SeriesListQuery = {} as SeriesListQuery,
  ): Promise<{ series: SeriesWithRelations[]; total: number }> {
    const where: Prisma.SeriesWhereInput = {
      ...(query.kindKey ? { kindKey: query.kindKey } : {}),
      unit: {
        type: UnitType.SERIES,
        ...(query.status ? { status: query.status as UnitStatus } : {}),
        ...(query.visibility
          ? { visibility: query.visibility as UnitVisibility }
          : {}),
        ...(query.language
          ? { translations: { some: { language: query.language } } }
          : {}),
        ...(query.q?.trim()
          ? {
              translations: {
                some: { title: { contains: query.q, mode: "insensitive" } },
              },
            }
          : {}),
        ...(query.relatedWorkUnitId
          ? {
              workMemberships: {
                some: {
                  workUnitId: query.relatedWorkUnitId,
                  role: SERIES_ROLE,
                },
              },
            }
          : {}),
      },
      ...(query.containsReleaseUnitId
        ? {
            directReleaseIndexRows: {
              some: { releaseUnitId: query.containsReleaseUnitId },
            },
          }
        : {}),
    };

    const limit = Math.max(1, Math.min(query.limit ?? 20, 100));
    const [rows, total] = await Promise.all([
      prisma.series.findMany({
        where,
        include: seriesInclude,
        orderBy: seriesOrderBy,
        skip: query.start ?? 0,
        take: limit,
      }),
      prisma.series.count({ where }),
    ]);

    return { series: rows, total };
  }

  async getByUnitId(unitId: string): Promise<SeriesWithRelations> {
    return prisma.series.findUniqueOrThrow({
      where: { unitId },
      include: seriesInclude,
    });
  }

  async getDetail(unitId: string): Promise<SeriesDetailDTO> {
    const [series, contentStructure] = await Promise.all([
      this.getByUnitId(unitId),
      contentStructureService.getByOwnerUnitId(unitId),
    ]);
    return {
      ...mapSeriesToDTO(series),
      contentStructure,
      directReleaseCount: series._count.directReleaseIndexRows,
    };
  }

  async create(input: CreateSeriesInput): Promise<SeriesWithRelations> {
    const series = await prisma.$transaction(async (tx) => {
      const created = await tx.series.create({
        data: {
          kindKey: input.kindKey,
          extra: (input.extra ?? null) as Prisma.InputJsonValue,
          unit: {
            create: {
              userId: input.userId,
              slugScope: pickSlugScope(UnitType.SERIES, input.userId),
              type: UnitType.SERIES,
              status: (input.status as UnitStatus) ?? UnitStatus.DRAFT,
              visibility:
                (input.visibility as UnitVisibility | undefined) ?? undefined,
              defaultLanguage: input.defaultLanguage ?? undefined,
              rating: (input.rating as ContentRating | undefined) ?? undefined,
              licenseSlug: assertLicenseSlug(input.licenseSlug) ?? undefined,
              translations: input.translations?.length
                ? {
                    create: input.translations.map((tr) => {
                      assertUnitTranslationExtraAllowed(tr.extra ?? null);
                      return {
                        language: tr.language,
                        title: tr.title ?? undefined,
                        subtitle: tr.subtitle ?? undefined,
                        summary: tr.summary ?? undefined,
                        description: nullableContentDocJson(tr.description),
                        extra: (tr.extra ?? null) as Prisma.InputJsonValue,
                        sourceUnitId: tr.sourceUnitId ?? undefined,
                      };
                    }),
                  }
                : undefined,
            },
          },
        },
        include: seriesInclude,
      });
      await contentStructureService.ensureForOwner(tx, created.unitId);
      return created;
    });

    await enqueueSeriesProjectionSync(series.unitId, []);
    return series;
  }

  async update(
    unitId: string,
    input: UpdateSeriesInput,
  ): Promise<SeriesWithRelations> {
    const row = await prisma.series.update({
      where: { unitId },
      data: {
        kindKey: input.kindKey ?? undefined,
        extra:
          input.extra === undefined
            ? undefined
            : ((input.extra ?? null) as Prisma.InputJsonValue),
        unit: {
          update: {
            status: (input.status as UnitStatus | undefined) ?? undefined,
            visibility:
              (input.visibility as UnitVisibility | undefined) ?? undefined,
            rating: (input.rating as ContentRating | undefined) ?? undefined,
            defaultLanguage: input.defaultLanguage ?? undefined,
            licenseSlug:
              input.licenseSlug === null
                ? null
                : (assertLicenseSlug(input.licenseSlug) ?? undefined),
          },
        },
      },
      include: seriesInclude,
    });
    await enqueueSeriesProjectionSync(unitId, []);
    return row;
  }

  async updateContentStructure(
    seriesUnitId: string,
    nodes: ContentStructureItem[],
    actorUserId?: string,
  ) {
    await prisma.$transaction(async (tx) => {
      await this.assertSeriesUnit(tx, seriesUnitId);
      await this.assertValidSeriesContentNodes(tx, nodes);
    });

    return contentStructureService.update(seriesUnitId, nodes, {
      actorUserId,
      eventType: "series.contentStructure.batch",
      changedFieldKeys: ["series.contentStructure"],
      afterMutate: async (tx) => {
        await this.reconcileSeriesProjections(tx, seriesUnitId);
      },
    });
  }

  async listContentIndex(
    seriesUnitId: string,
  ): Promise<SeriesContentIndexDTO[]> {
    const rows = await prisma.seriesContentIndex.findMany({
      where: { seriesUnitId },
      orderBy: [{ createdAt: "asc" }, { contentNodeId: "asc" }],
    });
    return rows.map(mapSeriesContentIndexToDTO);
  }

  async diagnostics(seriesUnitId: string): Promise<SeriesDiagnosticsDTO> {
    const [nestedSeriesNodes, indexedRows] = await Promise.all([
      prisma.contentStructureNode.findMany({
        where: {
          ownerUnitId: seriesUnitId,
          contentUnit: { type: UnitType.SERIES },
        },
        select: { contentUnitId: true },
      }),
      prisma.seriesContentIndex.findMany({
        where: { seriesUnitId },
        include: {
          releaseUnit: {
            include: {
              translations: true,
              externalRefs: true,
              workMemberships: {
                where: { role: RELEASE_ROLE },
                select: { workUnitId: true, displayPolicy: true },
              },
            },
          },
        },
      }),
    ]);

    const weakDisplayReleaseUnitIds: string[] = [];
    const missingTranslationReleaseUnitIds: string[] = [];
    const missingSourceReleaseUnitIds: string[] = [];
    const betterRepresentativeCandidateWorkUnitIds = new Set<string>();
    for (const row of indexedRows) {
      const translations = row.releaseUnit.translations;
      const hasTitle = translations.some((tr) => tr.title);
      if (!hasTitle) weakDisplayReleaseUnitIds.push(row.releaseUnitId);
      if (translations.length === 0) {
        missingTranslationReleaseUnitIds.push(row.releaseUnitId);
      }
      if (row.releaseUnit.externalRefs.length === 0) {
        missingSourceReleaseUnitIds.push(row.releaseUnitId);
      }
      for (const membership of row.releaseUnit.workMemberships) {
        if (membership.displayPolicy !== UnitWorkDisplayPolicy.PRIMARY) {
          betterRepresentativeCandidateWorkUnitIds.add(membership.workUnitId);
        }
      }
    }

    return {
      seriesUnitId,
      nestedSeriesReferenceUnitIds: [
        ...new Set(
          nestedSeriesNodes
            .map((node) => node.contentUnitId)
            .filter((id): id is string => !!id),
        ),
      ],
      weakDisplayReleaseUnitIds,
      missingTranslationReleaseUnitIds,
      missingSourceReleaseUnitIds,
      betterRepresentativeCandidateWorkUnitIds: [
        ...betterRepresentativeCandidateWorkUnitIds,
      ],
    };
  }

  async reconcileSeriesProjections(
    tx: Tx,
    seriesUnitId: string,
  ): Promise<string[]> {
    await this.assertSeriesUnit(tx, seriesUnitId);
    const releaseNodes = await tx.contentStructureNode.findMany({
      where: {
        ownerUnitId: seriesUnitId,
        contentUnit: {
          type: { in: RELEASE_UNIT_TYPES },
          workMemberships: { some: { role: RELEASE_ROLE } },
        },
      },
      select: {
        id: true,
        contentUnitId: true,
        contentUnit: {
          select: {
            workMemberships: {
              where: { role: RELEASE_ROLE },
              select: { workUnitId: true },
            },
          },
        },
      },
      orderBy: [{ sortKey: "asc" }, { id: "asc" }],
    });

    await tx.seriesContentIndex.deleteMany({ where: { seriesUnitId } });
    const directRows = releaseNodes
      .filter((node) => node.contentUnitId)
      .map((node) => ({
        seriesUnitId,
        releaseUnitId: node.contentUnitId!,
        contentNodeId: node.id,
      }));
    if (directRows.length > 0) {
      await tx.seriesContentIndex.createMany({
        data: directRows,
        skipDuplicates: true,
      });
    }

    const desiredWorkUnitIds = [
      ...new Set(
        releaseNodes.flatMap(
          (node) =>
            node.contentUnit?.workMemberships.map((row) => row.workUnitId) ??
            [],
        ),
      ),
    ];

    await tx.unitWork.deleteMany({
      where: {
        unitId: seriesUnitId,
        role: SERIES_ROLE,
        ...(desiredWorkUnitIds.length > 0
          ? { workUnitId: { notIn: desiredWorkUnitIds } }
          : {}),
      },
    });

    for (const workUnitId of desiredWorkUnitIds) {
      await tx.unitWork.upsert({
        where: {
          unitId_workUnitId_role: {
            unitId: seriesUnitId,
            workUnitId,
            role: SERIES_ROLE,
          },
        },
        update: {},
        create: {
          unitId: seriesUnitId,
          workUnitId,
          role: SERIES_ROLE,
          displayPolicy: UnitWorkDisplayPolicy.PRIMARY,
        },
      });
    }

    await enqueueSeriesProjectionSync(seriesUnitId, desiredWorkUnitIds);
    return desiredWorkUnitIds;
  }

  async explainRepresentativeRelease(
    workUnitId: string,
    explicitReleaseUnitId?: string,
  ): Promise<RepresentativeReleaseSelection> {
    const memberships = await prisma.unitWork.findMany({
      where: { workUnitId, role: RELEASE_ROLE },
      include: {
        unit: {
          include: {
            translations: true,
            externalRefs: true,
          },
        },
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }, { unitId: "asc" }],
    });
    if (memberships.length === 0) {
      throw new AppError(404, "No releases found for work domain", {
        code: "series_representative_release_none",
      });
    }

    const candidates = memberships.map((membership) => {
      const translationCount = membership.unit.translations.length;
      const sourceCount = membership.unit.externalRefs.length;
      const hasTitle = membership.unit.translations.some((tr) => tr.title);
      const explicit = membership.unitId === explicitReleaseUnitId;
      const primary =
        membership.displayPolicy === UnitWorkDisplayPolicy.PRIMARY;
      const reason = explicit
        ? "explicit_selection"
        : primary
          ? "primary_canonical_release"
          : translationCount > 0
            ? "translation_coverage"
            : sourceCount > 0
              ? "source_quality"
              : hasTitle
                ? "display_completeness"
                : "deterministic_fallback";
      return {
        releaseUnitId: membership.unitId,
        workUnitId,
        reason,
        score:
          (explicit ? 100 : 0) +
          (primary ? 50 : 0) +
          translationCount * 10 +
          sourceCount * 4 +
          (hasTitle ? 2 : 0),
        translationCoverageLocales: membership.unit.translations.map(
          (tr) => tr.language as Language,
        ),
        hasPrimaryCanonicalSignal: primary,
        hasStrongSourceQuality: sourceCount > 0,
        hasDisplayCompleteness: hasTitle,
      };
    });

    const [selected] = [...candidates].sort(
      (a, b) =>
        (b.score ?? 0) - (a.score ?? 0) ||
        a.releaseUnitId.localeCompare(b.releaseUnitId),
    );
    if (!selected) {
      throw new AppError(404, "No representative release candidate found", {
        code: "series_representative_release_none",
      });
    }
    return {
      workUnitId,
      selectedReleaseUnitId: selected.releaseUnitId,
      reason: selected.reason as RepresentativeReleaseSelection["reason"],
      candidates: candidates.map((candidate) => ({
        ...candidate,
        reason:
          candidate.reason as RepresentativeReleaseSelection["candidates"][number]["reason"],
      })),
    };
  }

  private async assertSeriesUnit(tx: Tx, seriesUnitId: string): Promise<void> {
    const series = await tx.series.findUnique({
      where: { unitId: seriesUnitId },
      select: { unitId: true },
    });
    if (!series) {
      throw new AppError(404, "Series not found", {
        code: "series_not_found",
      });
    }
  }

  private async assertValidSeriesContentNodes(
    tx: Tx,
    nodes: readonly ContentStructureItem[],
  ): Promise<void> {
    const contentUnitIds = [
      ...new Set(
        flattenContentNodes(nodes)
          .map((node) => node.contentUnitId)
          .filter((id): id is string => !!id),
      ),
    ];
    if (contentUnitIds.length === 0) return;

    const units = await tx.unit.findMany({
      where: { id: { in: contentUnitIds } },
      select: {
        id: true,
        type: true,
        workMemberships: {
          where: { role: RELEASE_ROLE },
          select: { workUnitId: true },
        },
      },
    });
    const byId = new Map(units.map((unit) => [unit.id, unit]));

    for (const unitId of contentUnitIds) {
      const unit = byId.get(unitId);
      if (!unit) {
        throw new AppError(404, "Series content Unit not found", {
          code: "series_content_unit_not_found",
          details: { unitId },
        });
      }
      if (unit.type === UnitType.SERIES) continue;
      if (
        RELEASE_UNIT_TYPE_SET.has(unit.type) &&
        unit.workMemberships.length > 0
      ) {
        continue;
      }
      throw new AppError(
        400,
        "Series content nodes must reference release Units or nested Series references",
        {
          code: "series_content_invalid_unit_type",
          details: { unitId, unitType: unit.type },
        },
      );
    }
  }
}

export const seriesService = new SeriesService();
