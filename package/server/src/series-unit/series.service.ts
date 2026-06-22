import {
  CATALOG_UNIT_TYPES,
  type ContentStructureItem,
  type CreateSeriesInput,
  type SeriesContentIndexDTO,
  type SeriesDetailDTO,
  type SeriesDiagnosticsDTO,
  type SeriesListQuery,
  type UpdateSeriesInput,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { and, count, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { nullableContentDocJson } from "@/content-doc/json-write";
import { contentStructureService } from "@/content-structure";
import { pickSlugScope } from "@/infra/slug-scopes";
import { serverJobProducer } from "@/job/job-boundary";
import { assertLicenseSlug } from "@/unit/publication-policy";
import { assertUnitTranslationExtraAllowed } from "@/unit/translation-extra";
import { AppError } from "@/utils/errors";
import {
  ContentStructure,
  ContentStructureNode,
  Series,
  SeriesContentIndex,
  Unit,
  UnitExternalLink,
  UnitSupportLanguage,
  UnitTranslation,
  User,
} from "../db/schema";
import { mapSeriesContentIndexToDTO, mapSeriesToDTO } from "./series.mapper";
import type { SeriesWithRelations } from "./series.types";

const RELEASE_UNIT_TYPE_SET: ReadonlySet<string> = new Set(CATALOG_UNIT_TYPES);

type SeriesProjectionTx = any;

export type SeriesRepository = {
  list(
    query: SeriesListQuery,
  ): Promise<{ series: SeriesWithRelations[]; total: number }>;
  getByUnitId(unitId: string): Promise<SeriesWithRelations>;
  create(input: CreateSeriesInput): Promise<SeriesWithRelations>;
  update(
    unitId: string,
    input: UpdateSeriesInput,
  ): Promise<SeriesWithRelations>;
  assertSeriesUnit(seriesUnitId: string): Promise<void>;
  assertValidSeriesContentNodes(
    nodes: readonly ContentStructureItem[],
  ): Promise<void>;
  listContentIndex(seriesUnitId: string): Promise<SeriesContentIndexDTO[]>;
  diagnostics(seriesUnitId: string): Promise<SeriesDiagnosticsDTO>;
  reconcileSeriesProjections(
    tx: SeriesProjectionTx | null,
    seriesUnitId: string,
  ): Promise<string[]>;
};

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
): Promise<void> {
  const source = { type: "server" as const, service: "series" };
  await serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.contentSync,
      { unitId: seriesUnitId },
      source,
    ),
  );
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function publicUserColumns() {
  return {
    unitId: User.unitId,
    name: User.name,
    avatar: User.avatar,
    summary: User.summary,
    description: User.description,
    followersCount: User.followersCount,
    followingsCount: User.followingsCount,
  };
}

async function hydrateSeries(
  database: Awaited<ReturnType<typeof getServerDb>>,
  unitId: string,
): Promise<SeriesWithRelations | null> {
  const [row] = await database
    .select({ series: Series, unit: Unit, user: publicUserColumns() })
    .from(Series)
    .innerJoin(Unit, eq(Series.unitId, Unit.id))
    .leftJoin(User, eq(Unit.userId, User.unitId))
    .where(eq(Series.unitId, unitId))
    .limit(1);
  if (!row) return null;

  const [translations, supportLanguages, countRows] = await Promise.all([
    database
      .select()
      .from(UnitTranslation)
      .where(eq(UnitTranslation.unitId, unitId)),
    database
      .select()
      .from(UnitSupportLanguage)
      .where(eq(UnitSupportLanguage.unitId, unitId)),
    database
      .select({ value: count() })
      .from(SeriesContentIndex)
      .where(eq(SeriesContentIndex.seriesUnitId, unitId)),
  ]);

  return {
    ...row.series,
    unit: {
      ...row.unit,
      user: row.user,
      translations,
      supportLanguages,
    },
    _count: { directReleaseIndexRows: countRows[0]?.value ?? 0 },
  };
}

async function hydrateSeriesOrThrow(
  database: Awaited<ReturnType<typeof getServerDb>>,
  unitId: string,
): Promise<SeriesWithRelations> {
  const row = await hydrateSeries(database, unitId);
  if (!row) throw new Error(`Series not found: ${unitId}`);
  return row;
}

function createDrizzleSeriesRepository(): SeriesRepository {
  return {
    async list(query) {
      const db = await getServerDb();
      const conditions = [eq(Unit.type, "SERIES")];
      if (query.kindKey) conditions.push(eq(Series.kindKey, query.kindKey));
      if (query.status) conditions.push(eq(Unit.status, query.status as never));
      if (query.visibility) {
        conditions.push(eq(Unit.visibility, query.visibility as never));
      }
      if (query.language) {
        conditions.push(sql`EXISTS (
          SELECT 1 FROM "UnitTranslation" tr
          WHERE tr."unitId" = ${Unit.id}
            AND tr."language" = ${query.language}
        )`);
      }
      if (query.q?.trim()) {
        conditions.push(sql`EXISTS (
          SELECT 1 FROM "UnitTranslation" tr
          WHERE tr."unitId" = ${Unit.id}
            AND tr."title" ILIKE ${`%${query.q.trim()}%`}
        )`);
      }
      if (query.containsReleaseUnitId) {
        conditions.push(sql`EXISTS (
          SELECT 1 FROM "SeriesContentIndex" idx
          WHERE idx."seriesUnitId" = ${Series.unitId}
            AND idx."releaseUnitId" = ${query.containsReleaseUnitId}
        )`);
      }
      const where = and(...conditions);
      const limit = Math.max(1, Math.min(query.limit ?? 20, 100));
      const [rows, totalRows] = await Promise.all([
        db
          .select({ unitId: Series.unitId })
          .from(Series)
          .innerJoin(Unit, eq(Series.unitId, Unit.id))
          .where(where)
          .orderBy(desc(Series.updatedAt), Series.unitId)
          .offset(query.start ?? 0)
          .limit(limit),
        db
          .select({ value: count() })
          .from(Series)
          .innerJoin(Unit, eq(Series.unitId, Unit.id))
          .where(where),
      ]);

      return {
        series: await Promise.all(
          rows.map((row) => hydrateSeriesOrThrow(db, row.unitId)),
        ),
        total: totalRows[0]?.value ?? 0,
      };
    },
    async getByUnitId(unitId) {
      const db = await getServerDb();
      return hydrateSeriesOrThrow(db, unitId);
    },
    async create(input) {
      const db = await getServerDb();
      const unitId = await db.transaction(async (tx) => {
        const now = new Date();
        const [unit] = await tx
          .insert(Unit)
          .values({
            userId: input.userId ?? null,
            slugScope: pickSlugScope("SERIES", input.userId),
            type: "SERIES",
            status: (input.status ??
              "DRAFT") as typeof Unit.$inferInsert.status,
            visibility: input.visibility as typeof Unit.$inferInsert.visibility,
            defaultLanguage: input.defaultLanguage ?? null,
            rating: input.rating as typeof Unit.$inferInsert.rating,
            licenseSlug: assertLicenseSlug(input.licenseSlug) ?? null,
            updatedAt: now,
          })
          .returning({ id: Unit.id });
        if (!unit) throw new Error("Failed to create Series Unit");

        if (input.translations?.length) {
          for (const tr of input.translations) {
            assertUnitTranslationExtraAllowed(tr.extra ?? null);
          }
          await tx.insert(UnitTranslation).values(
            input.translations.map((tr) => ({
              unitId: unit.id,
              language: tr.language,
              title: tr.title ?? null,
              subtitle: tr.subtitle ?? null,
              summary: tr.summary ?? null,
              description: nullableContentDocJson(tr.description),
              extra: tr.extra ?? null,
              sourceUnitId: tr.sourceUnitId ?? null,
              updatedAt: now,
            })),
          );
        }
        await tx.insert(Series).values({
          unitId: unit.id,
          kindKey: input.kindKey,
          extra: input.extra ?? null,
          updatedAt: now,
        });
        await tx
          .insert(ContentStructure)
          .values({ ownerUnitId: unit.id, updatedAt: now })
          .onConflictDoNothing();
        return unit.id;
      });
      return hydrateSeriesOrThrow(db, unitId);
    },
    async update(unitId, input) {
      const db = await getServerDb();
      await db.transaction(async (tx) => {
        if (input.kindKey !== undefined || input.extra !== undefined) {
          await tx
            .update(Series)
            .set({
              ...(input.kindKey !== undefined
                ? { kindKey: input.kindKey }
                : {}),
              ...(input.extra !== undefined
                ? { extra: input.extra ?? null }
                : {}),
              updatedAt: new Date(),
            })
            .where(eq(Series.unitId, unitId));
        }
        const unitPatch: Partial<typeof Unit.$inferInsert> = {};
        if (input.status !== undefined)
          unitPatch.status = input.status as never;
        if (input.visibility !== undefined) {
          unitPatch.visibility = input.visibility as never;
        }
        if (input.rating !== undefined)
          unitPatch.rating = input.rating as never;
        if (input.defaultLanguage !== undefined) {
          unitPatch.defaultLanguage = input.defaultLanguage;
        }
        if (input.licenseSlug !== undefined) {
          unitPatch.licenseSlug =
            input.licenseSlug === null
              ? null
              : (assertLicenseSlug(input.licenseSlug) ?? null);
        }
        if (Object.keys(unitPatch).length > 0) {
          await tx
            .update(Unit)
            .set({ ...unitPatch, updatedAt: new Date() })
            .where(eq(Unit.id, unitId));
        }
      });
      return hydrateSeriesOrThrow(db, unitId);
    },
    async assertSeriesUnit(seriesUnitId) {
      const row = await this.getByUnitId(seriesUnitId).catch(() => null);
      if (!row) {
        throw new AppError(404, "Series not found", {
          code: "series_not_found",
        });
      }
    },
    async assertValidSeriesContentNodes(nodes) {
      const contentUnitIds = [
        ...new Set(
          flattenContentNodes(nodes)
            .map((node) => node.contentUnitId)
            .filter((id): id is string => !!id),
        ),
      ];
      if (contentUnitIds.length === 0) return;

      const db = await getServerDb();
      const units = await db
        .select({ id: Unit.id, type: Unit.type })
        .from(Unit)
        .where(inArray(Unit.id, contentUnitIds));
      const byId = new Map(units.map((unit) => [unit.id, unit]));

      for (const unitId of contentUnitIds) {
        const unit = byId.get(unitId);
        if (!unit) {
          throw new AppError(404, "Series content Unit not found", {
            code: "series_content_unit_not_found",
            details: { unitId },
          });
        }
        if (unit.type === "SERIES") continue;
        if (RELEASE_UNIT_TYPE_SET.has(unit.type)) continue;
        throw new AppError(
          400,
          "Series content nodes must reference release Units or nested Series references",
          {
            code: "series_content_invalid_unit_type",
            details: { unitId, unitType: unit.type },
          },
        );
      }
    },
    async listContentIndex(seriesUnitId) {
      const db = await getServerDb();
      const rows = await db
        .select()
        .from(SeriesContentIndex)
        .where(eq(SeriesContentIndex.seriesUnitId, seriesUnitId))
        .orderBy(
          SeriesContentIndex.createdAt,
          SeriesContentIndex.contentNodeId,
        );
      return rows.map(mapSeriesContentIndexToDTO);
    },
    async diagnostics(seriesUnitId) {
      const db = await getServerDb();
      const [nestedSeriesNodes, indexedRows] = await Promise.all([
        db
          .select({ contentUnitId: ContentStructureNode.contentUnitId })
          .from(ContentStructureNode)
          .innerJoin(Unit, eq(ContentStructureNode.contentUnitId, Unit.id))
          .where(
            and(
              eq(ContentStructureNode.ownerUnitId, seriesUnitId),
              eq(ContentStructureNode.isDeleted, false),
              eq(Unit.type, "SERIES"),
            ),
          ),
        db
          .select({ releaseUnitId: SeriesContentIndex.releaseUnitId })
          .from(SeriesContentIndex)
          .where(eq(SeriesContentIndex.seriesUnitId, seriesUnitId)),
      ]);

      const releaseUnitIds = indexedRows.map((row) => row.releaseUnitId);
      const [translations, refs] =
        releaseUnitIds.length === 0
          ? [[], []]
          : await Promise.all([
              db
                .select({
                  unitId: UnitTranslation.unitId,
                  title: UnitTranslation.title,
                })
                .from(UnitTranslation)
                .where(inArray(UnitTranslation.unitId, releaseUnitIds)),
              db
                .select({ unitId: UnitExternalLink.unitId })
                .from(UnitExternalLink)
                .where(inArray(UnitExternalLink.unitId, releaseUnitIds)),
            ]);
      const translationsByUnitId = new Map<string, typeof translations>();
      for (const tr of translations) {
        const list = translationsByUnitId.get(tr.unitId) ?? [];
        list.push(tr);
        translationsByUnitId.set(tr.unitId, list);
      }
      const refsByUnitId = new Set(refs.map((ref) => ref.unitId));

      return {
        seriesUnitId,
        nestedSeriesReferenceUnitIds: [
          ...new Set(
            nestedSeriesNodes
              .map((node) => node.contentUnitId)
              .filter((id): id is string => !!id),
          ),
        ],
        weakDisplayReleaseUnitIds: releaseUnitIds.filter(
          (id) => !(translationsByUnitId.get(id) ?? []).some((tr) => tr.title),
        ),
        missingTranslationReleaseUnitIds: releaseUnitIds.filter(
          (id) => (translationsByUnitId.get(id) ?? []).length === 0,
        ),
        missingSourceReleaseUnitIds: releaseUnitIds.filter(
          (id) => !refsByUnitId.has(id),
        ),
      };
    },
    async reconcileSeriesProjections(tx, seriesUnitId) {
      if (tx?.contentStructureNode && tx?.seriesContentIndex) {
        const releaseNodes = await tx.contentStructureNode.findMany({
          where: {
            ownerUnitId: seriesUnitId,
            isDeleted: false,
            contentUnit: { type: { in: [...CATALOG_UNIT_TYPES] } },
          },
          select: { id: true, contentUnitId: true },
          orderBy: [{ position: "asc" }, { id: "asc" }],
        });
        await tx.seriesContentIndex.deleteMany({ where: { seriesUnitId } });
        const directRows = releaseNodes
          .filter(
            (node: { contentUnitId: string | null }) => node.contentUnitId,
          )
          .map((node: { id: string; contentUnitId: string }) => ({
            seriesUnitId,
            releaseUnitId: node.contentUnitId,
            contentNodeId: node.id,
          }));
        if (directRows.length > 0) {
          await tx.seriesContentIndex.createMany({
            data: directRows,
            skipDuplicates: true,
          });
        }
        return directRows.map(
          (row: { releaseUnitId: string }) => row.releaseUnitId,
        );
      }

      const reconcileWithDrizzle = async (inner: any) => {
        const releaseNodes: Array<{
          id: string;
          contentUnitId: string | null;
        }> = await inner
          .select({
            id: ContentStructureNode.id,
            contentUnitId: ContentStructureNode.contentUnitId,
          })
          .from(ContentStructureNode)
          .innerJoin(Unit, eq(ContentStructureNode.contentUnitId, Unit.id))
          .where(
            and(
              eq(ContentStructureNode.ownerUnitId, seriesUnitId),
              eq(ContentStructureNode.isDeleted, false),
              inArray(Unit.type, [...CATALOG_UNIT_TYPES] as never),
            ),
          )
          .orderBy(ContentStructureNode.position, ContentStructureNode.id);
        await inner
          .delete(SeriesContentIndex)
          .where(eq(SeriesContentIndex.seriesUnitId, seriesUnitId));
        const directRows = releaseNodes
          .filter((node) => node.contentUnitId)
          .map((node) => ({
            seriesUnitId,
            releaseUnitId: node.contentUnitId!,
            contentNodeId: node.id,
            updatedAt: new Date(),
          }));
        if (directRows.length > 0) {
          await inner
            .insert(SeriesContentIndex)
            .values(directRows)
            .onConflictDoNothing();
        }
        return directRows.map((row) => row.releaseUnitId);
      };

      if (tx?.select && tx?.delete && tx?.insert) {
        return reconcileWithDrizzle(tx);
      }

      const db = await getServerDb();
      return db.transaction(reconcileWithDrizzle);
    },
  };
}

export class SeriesService {
  constructor(
    private readonly repository: SeriesRepository = createDrizzleSeriesRepository(),
  ) {}

  async list(
    query: SeriesListQuery = {} as SeriesListQuery,
  ): Promise<{ series: SeriesWithRelations[]; total: number }> {
    return this.repository.list(query);
  }

  async getByUnitId(unitId: string): Promise<SeriesWithRelations> {
    return this.repository.getByUnitId(unitId);
  }

  async getDetail(unitId: string): Promise<SeriesDetailDTO> {
    const [series, contentStructure] = await Promise.all([
      this.getByUnitId(unitId),
      contentStructureService.getByOwnerUnitId(unitId),
    ]);
    return {
      ...mapSeriesToDTO(series),
      contentStructure,
      directReleaseCount: series._count?.directReleaseIndexRows ?? 0,
    };
  }

  async create(input: CreateSeriesInput): Promise<SeriesWithRelations> {
    const series = await this.repository.create(input);
    await enqueueSeriesProjectionSync(series.unitId);
    return series;
  }

  async update(
    unitId: string,
    input: UpdateSeriesInput,
  ): Promise<SeriesWithRelations> {
    const row = await this.repository.update(unitId, input);
    await enqueueSeriesProjectionSync(unitId);
    return row;
  }

  async updateContentStructure(
    seriesUnitId: string,
    nodes: ContentStructureItem[],
    actorUserId?: string,
  ) {
    await this.repository.assertSeriesUnit(seriesUnitId);
    await this.repository.assertValidSeriesContentNodes(nodes);

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
    return this.repository.listContentIndex(seriesUnitId);
  }

  async diagnostics(seriesUnitId: string): Promise<SeriesDiagnosticsDTO> {
    return this.repository.diagnostics(seriesUnitId);
  }

  async reconcileSeriesProjections(
    tx: SeriesProjectionTx | null,
    seriesUnitId: string,
  ): Promise<string[]> {
    const releaseUnitIds = await this.repository.reconcileSeriesProjections(
      tx,
      seriesUnitId,
    );
    await enqueueSeriesProjectionSync(seriesUnitId);
    return releaseUnitIds;
  }
}

export const seriesService = new SeriesService();
