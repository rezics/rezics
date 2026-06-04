import {
  PROGRESS_EXTRA_KNOWN_KEYS,
  type ProgressLibraryListResponse,
  type ProgressLibraryRow,
  type ProgressLibraryUnitSummary,
  readCoverUrlFromExtra,
  type UnitProgressListResponse,
  type UnitProgressStatsResponse,
  userUnitProgressStatusValues,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { PROGRESS_BUCKET_COUNT } from "@rezics/search";
import { and, asc, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { serverJobProducer } from "@/job/job-boundary";
import { searchClient } from "@/meili/search-client";
import { AppError } from "@/utils/errors";
import {
  ContentStructureNode,
  ShelfUnit,
  Unit,
  UnitTranslation,
  UserContentNodeProgress,
  UserUnitProgress,
} from "../db/schema";
import { mapProgressToDTO } from "./progress.mapper";
import type {
  ProgressCursor,
  ProgressListInput,
  ProgressUpsertInput,
} from "./progress.types";
import { progressStatusMap } from "./progress.types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type UserUnitProgressRow = typeof UserUnitProgress.$inferSelect;
type ProgressStatus = UserUnitProgressRow["status"];

type TranslationRow = {
  language: string;
  title: string | null;
  extra?: unknown;
};

type TitleDisplay = {
  defaultLanguage: string | null;
  translations: TranslationRow[];
};

type UnitDisplay = TitleDisplay & {
  type: string;
  catalogEntryKind: ProgressLibraryUnitSummary["catalogEntryKind"];
  targetUnitId: string | null;
};

type ProgressPage = {
  rows: (UserUnitProgressRow & {
    unit?: UnitDisplay & { targetUnit?: UnitDisplay | null };
    lastReadNode?: { isDeleted: boolean } | null;
  })[];
  nextCursor: string | null;
};

type ContentNodeSummary = {
  ownerUnitId: string;
  isDeleted: boolean;
};

type ProgressCreateData = {
  userId: string;
  unitId: string;
  progress: number;
  status: ProgressStatus;
  isDeleted: boolean;
  completedCount: number;
  totalTimeMs: number;
  lastReadNodeId?: string | null;
  lastReadAnchor?: unknown;
  extra?: unknown;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

type ProgressUpdateData = {
  lastSeenAt: Date;
  isDeleted: boolean;
  progress?: number;
  status?: ProgressStatus;
  completedCount?: number;
  lastReadNodeId?: string | null;
  lastReadAnchor?: unknown;
  extra?: unknown;
  totalTimeMsIncrement?: number;
};

type ProgressShelfLinkRow = {
  unitId: string;
  variantUnitId: string | null;
  shelfId: string;
  shelf: { unit: TitleDisplay };
};

export type ProgressRepository = {
  findProgressState(
    userId: string,
    unitId: string,
  ): Promise<Pick<UserUnitProgressRow, "status" | "completedCount"> | null>;
  findProgress(
    userId: string,
    unitId: string,
  ): Promise<UserUnitProgressRow | null>;
  findContentNode(nodeId: string): Promise<ContentNodeSummary | null>;
  upsertProgress(input: {
    userId: string;
    unitId: string;
    create: ProgressCreateData;
    update: ProgressUpdateData;
  }): Promise<UserUnitProgressRow>;
  listProgressRows(input: {
    userId: string;
    cursorDate: Date | null;
    cursorUnitId: string | null;
    take: number;
  }): Promise<ProgressPage["rows"]>;
  findShelfLinks(
    userId: string,
    unitIds: string[],
  ): Promise<ProgressShelfLinkRow[]>;
  softDeleteProgress(userId: string, unitId: string, now: Date): Promise<void>;
  upsertNodeCompletion(userId: string, nodeId: string): Promise<void>;
  deleteNodeCompletion(userId: string, nodeId: string): Promise<void>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function encodeCursor(cursor: ProgressCursor): string {
  return encodeURIComponent(JSON.stringify(cursor));
}

function decodeCursor(cursor: string): ProgressCursor {
  try {
    const parsed = JSON.parse(decodeURIComponent(cursor)) as ProgressCursor;
    if (!parsed.lastSeenAt || !parsed.unitId) {
      throw new Error("missing cursor fields");
    }
    return parsed;
  } catch {
    throw new AppError(400, "Invalid progress cursor");
  }
}

function validateInput(input: ProgressUpsertInput): void {
  if (
    input.progress !== undefined &&
    (input.progress < 0 || input.progress > 1)
  ) {
    throw new AppError(400, "progress must be between 0 and 1");
  }

  if (input.addTimeMs !== undefined && input.addTimeMs < 0) {
    throw new AppError(400, "addTimeMs must be non-negative");
  }

  if (input.completedCount !== undefined && input.completedCount < 0) {
    throw new AppError(400, "completedCount must be non-negative");
  }

  if (input.extra !== undefined && input.extra !== null) {
    if (typeof input.extra !== "object" || Array.isArray(input.extra)) {
      throw new AppError(400, "extra must be an object");
    }
    for (const key of Object.keys(input.extra)) {
      if (!PROGRESS_EXTRA_KNOWN_KEYS.includes(key as never)) {
        throw new AppError(400, `extra contains unknown key: ${key}`);
      }
    }
  }
}

function readFacetCount(
  distribution: Record<string, number> | undefined,
  key: string | number,
): number {
  return distribution?.[String(key)] ?? 0;
}

function enqueueProgressSearch(
  kind:
    | typeof SEARCH_COMMAND_KINDS.progressSync
    | typeof SEARCH_COMMAND_KINDS.progressRemove,
  userId: string,
  unitId: string,
) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      kind,
      { userId, unitId },
      { type: "server", service: "progress" },
    ),
  );
}

/** Resolve a display title: default-language -> en -> first non-empty. */
function pickTitle(unit: TitleDisplay): string {
  const ordered = [
    unit.defaultLanguage
      ? unit.translations.find((t) => t.language === unit.defaultLanguage)
      : undefined,
    unit.translations.find((t) => t.language === "en"),
    ...unit.translations,
  ];
  for (const tr of ordered) {
    if (tr?.title) return tr.title;
  }
  return "";
}

/** Resolve a cover URL from translation extra, same order as title. */
function pickCover(unit: TitleDisplay): string | undefined {
  const ordered = [
    unit.defaultLanguage
      ? unit.translations.find((t) => t.language === unit.defaultLanguage)
      : undefined,
    unit.translations.find((t) => t.language === "en"),
    ...unit.translations,
  ];
  for (const tr of ordered) {
    const url = readCoverUrlFromExtra(tr?.extra);
    if (url) return url;
  }
  return undefined;
}

function unitSummary(
  unitId: string,
  unit: UnitDisplay,
): ProgressLibraryUnitSummary {
  return {
    unitId,
    title: pickTitle(unit) || unitId,
    coverUrl: pickCover(unit),
    unitType: unit.type as ProgressLibraryUnitSummary["unitType"],
    catalogEntryKind: unit.catalogEntryKind,
    targetUnitId: unit.targetUnitId,
  };
}

function createDrizzleProgressRepository(): ProgressRepository {
  async function hydrateProgressRows(
    rows: UserUnitProgressRow[],
  ): Promise<ProgressPage["rows"]> {
    if (rows.length === 0) return [];

    const db = await getServerDb();
    const unitIds = rows.map((row) => row.unitId);
    const lastReadNodeIds = rows
      .map((row) => row.lastReadNodeId)
      .filter((id): id is string => Boolean(id));

    const units = await db.select().from(Unit).where(inArray(Unit.id, unitIds));
    const targetUnitIds = units
      .map((unit) => unit.targetUnitId)
      .filter((id): id is string => Boolean(id));
    const allUnitIds = [...new Set([...unitIds, ...targetUnitIds])];

    const [targetUnits, translations, lastReadNodes] = await Promise.all([
      targetUnitIds.length
        ? db.select().from(Unit).where(inArray(Unit.id, targetUnitIds))
        : Promise.resolve([]),
      allUnitIds.length
        ? db
            .select()
            .from(UnitTranslation)
            .where(inArray(UnitTranslation.unitId, allUnitIds))
        : Promise.resolve([]),
      lastReadNodeIds.length
        ? db
            .select({
              id: ContentStructureNode.id,
              isDeleted: ContentStructureNode.isDeleted,
            })
            .from(ContentStructureNode)
            .where(inArray(ContentStructureNode.id, lastReadNodeIds))
        : Promise.resolve([]),
    ]);

    const translationsByUnit = new Map<string, TranslationRow[]>();
    for (const translation of translations) {
      const list = translationsByUnit.get(translation.unitId) ?? [];
      list.push({
        language: translation.language,
        title: translation.title,
        extra: translation.extra,
      });
      translationsByUnit.set(translation.unitId, list);
    }

    const toDisplay = (unit: typeof Unit.$inferSelect): UnitDisplay => ({
      type: unit.type,
      catalogEntryKind: unit.catalogEntryKind,
      targetUnitId: unit.targetUnitId,
      defaultLanguage: unit.defaultLanguage,
      translations: translationsByUnit.get(unit.id) ?? [],
    });

    const targetUnitsById = new Map(
      targetUnits.map((unit) => [unit.id, toDisplay(unit)]),
    );
    const unitsById = new Map(
      units.map((unit) => [
        unit.id,
        {
          ...toDisplay(unit),
          targetUnit: unit.targetUnitId
            ? (targetUnitsById.get(unit.targetUnitId) ?? null)
            : null,
        },
      ]),
    );
    const lastReadNodesById = new Map(
      lastReadNodes.map((node) => [
        node.id,
        { isDeleted: node.isDeleted } satisfies { isDeleted: boolean },
      ]),
    );

    return rows.map((row) => ({
      ...row,
      unit: unitsById.get(row.unitId),
      lastReadNode: row.lastReadNodeId
        ? (lastReadNodesById.get(row.lastReadNodeId) ?? null)
        : null,
    }));
  }

  return {
    async findProgressState(userId, unitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({
          status: UserUnitProgress.status,
          completedCount: UserUnitProgress.completedCount,
        })
        .from(UserUnitProgress)
        .where(
          and(
            eq(UserUnitProgress.userId, userId),
            eq(UserUnitProgress.unitId, unitId),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async findProgress(userId, unitId) {
      const db = await getServerDb();
      const [row] = await db
        .select()
        .from(UserUnitProgress)
        .where(
          and(
            eq(UserUnitProgress.userId, userId),
            eq(UserUnitProgress.unitId, unitId),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async findContentNode(nodeId) {
      const db = await getServerDb();
      const [node] = await db
        .select({
          ownerUnitId: ContentStructureNode.ownerUnitId,
          isDeleted: ContentStructureNode.isDeleted,
        })
        .from(ContentStructureNode)
        .where(eq(ContentStructureNode.id, nodeId))
        .limit(1);
      return node ?? null;
    },
    async upsertProgress({ userId, unitId, create, update }) {
      const db = await getServerDb();
      const set: Record<string, unknown> = {
        lastSeenAt: update.lastSeenAt,
        isDeleted: update.isDeleted,
      };
      if (update.progress !== undefined) set.progress = update.progress;
      if (update.status !== undefined) set.status = update.status;
      if (update.completedCount !== undefined) {
        set.completedCount = update.completedCount;
      }
      if (update.lastReadNodeId !== undefined) {
        set.lastReadNodeId = update.lastReadNodeId;
      }
      if (update.lastReadAnchor !== undefined) {
        set.lastReadAnchor = update.lastReadAnchor;
      }
      if (update.extra !== undefined) set.extra = update.extra;
      if (update.totalTimeMsIncrement !== undefined) {
        set.totalTimeMs = sql`${UserUnitProgress.totalTimeMs} + ${update.totalTimeMsIncrement}`;
      }

      const [row] = await db
        .insert(UserUnitProgress)
        .values(create)
        .onConflictDoUpdate({
          target: [UserUnitProgress.userId, UserUnitProgress.unitId],
          set,
        })
        .returning();
      if (!row) {
        throw new AppError(500, "Failed to write progress");
      }
      return row;
    },
    async listProgressRows({ userId, cursorDate, cursorUnitId, take }) {
      const db = await getServerDb();
      const conditions = [
        eq(UserUnitProgress.userId, userId),
        eq(UserUnitProgress.isDeleted, false),
      ];
      if (cursorDate && cursorUnitId) {
        conditions.push(
          or(
            lt(UserUnitProgress.lastSeenAt, cursorDate),
            and(
              eq(UserUnitProgress.lastSeenAt, cursorDate),
              lt(UserUnitProgress.unitId, cursorUnitId),
            ),
          )!,
        );
      }

      const rows = await db
        .select()
        .from(UserUnitProgress)
        .where(and(...conditions))
        .orderBy(
          desc(UserUnitProgress.lastSeenAt),
          desc(UserUnitProgress.unitId),
        )
        .limit(take);
      return hydrateProgressRows(rows);
    },
    async findShelfLinks(userId, unitIds) {
      if (unitIds.length === 0) return [];
      const db = await getServerDb();
      const rows = await db
        .select({
          unitId: ShelfUnit.unitId,
          variantUnitId: ShelfUnit.variantUnitId,
          shelfId: ShelfUnit.shelfId,
          shelfDefaultLanguage: Unit.defaultLanguage,
          translationLanguage: UnitTranslation.language,
          translationTitle: UnitTranslation.title,
        })
        .from(ShelfUnit)
        .innerJoin(Unit, eq(ShelfUnit.shelfId, Unit.id))
        .leftJoin(
          UnitTranslation,
          eq(UnitTranslation.unitId, ShelfUnit.shelfId),
        )
        .where(
          and(
            or(
              inArray(ShelfUnit.unitId, unitIds),
              inArray(ShelfUnit.variantUnitId, unitIds),
            ),
            eq(Unit.userId, userId),
          ),
        )
        .orderBy(asc(ShelfUnit.createdAt), asc(UnitTranslation.language));

      const byShelfLink = new Map<string, ProgressShelfLinkRow>();
      for (const row of rows) {
        const key = `${row.shelfId}:${row.unitId}:${row.variantUnitId ?? ""}`;
        const link =
          byShelfLink.get(key) ??
          ({
            unitId: row.unitId,
            variantUnitId: row.variantUnitId,
            shelfId: row.shelfId,
            shelf: {
              unit: {
                defaultLanguage: row.shelfDefaultLanguage,
                translations: [],
              },
            },
          } satisfies ProgressShelfLinkRow);
        if (row.translationLanguage) {
          link.shelf.unit.translations.push({
            language: row.translationLanguage,
            title: row.translationTitle,
          });
        }
        byShelfLink.set(key, link);
      }
      return [...byShelfLink.values()];
    },
    async softDeleteProgress(userId, unitId, now) {
      const db = await getServerDb();
      await db
        .update(UserUnitProgress)
        .set({ isDeleted: true, lastSeenAt: now })
        .where(
          and(
            eq(UserUnitProgress.userId, userId),
            eq(UserUnitProgress.unitId, unitId),
          ),
        );
    },
    async upsertNodeCompletion(userId, nodeId) {
      const db = await getServerDb();
      await db
        .insert(UserContentNodeProgress)
        .values({ userId, nodeId })
        .onConflictDoNothing();
    },
    async deleteNodeCompletion(userId, nodeId) {
      const db = await getServerDb();
      await db
        .delete(UserContentNodeProgress)
        .where(
          and(
            eq(UserContentNodeProgress.userId, userId),
            eq(UserContentNodeProgress.nodeId, nodeId),
          ),
        );
    },
  };
}

export class ProgressService {
  constructor(
    private readonly repository: ProgressRepository = createDrizzleProgressRepository(),
  ) {}

  async upsert(
    userId: string,
    unitId: string,
    input: ProgressUpsertInput,
  ): Promise<UserUnitProgressRow> {
    validateInput(input);

    const now = new Date();
    const addTimeMs = input.addTimeMs ?? 0;
    const coercedStatus =
      input.status === undefined && input.progress !== undefined
        ? input.progress >= 1
          ? "COMPLETED"
          : undefined
        : input.status !== undefined
          ? progressStatusMap[input.status]
          : undefined;
    const existing =
      coercedStatus === "COMPLETED" || input.completedCount !== undefined
        ? await this.repository.findProgressState(userId, unitId)
        : null;
    const isCompletionTransition =
      coercedStatus === "COMPLETED" && existing?.status !== "COMPLETED";
    const completedCount =
      input.completedCount !== undefined
        ? input.completedCount
        : isCompletionTransition
          ? (existing?.completedCount ?? 0) + 1
          : undefined;

    if (input.lastReadNodeId) {
      const node = await this.repository.findContentNode(input.lastReadNodeId);
      if (!node) {
        throw new AppError(404, "lastReadNodeId does not reference a node", {
          code: "content_structure_node_not_found",
        });
      }
      if (node.isDeleted) {
        throw new AppError(409, "lastReadNodeId targets a deleted node", {
          code: "content_structure_node_deleted",
        });
      }
    }

    const createData: ProgressCreateData = {
      userId,
      unitId,
      progress: input.progress ?? 0,
      status: coercedStatus ?? "BACKLOG",
      isDeleted: false,
      completedCount: completedCount ?? (coercedStatus === "COMPLETED" ? 1 : 0),
      totalTimeMs: addTimeMs,
      ...(input.lastReadNodeId ? { lastReadNodeId: input.lastReadNodeId } : {}),
      lastReadAnchor:
        input.lastReadAnchor !== undefined
          ? (input.lastReadAnchor ?? null)
          : undefined,
      extra: input.extra !== undefined ? (input.extra ?? null) : undefined,
      firstSeenAt: now,
      lastSeenAt: now,
    };

    const updateData: ProgressUpdateData = {
      lastSeenAt: now,
      isDeleted: false,
      ...(input.progress !== undefined ? { progress: input.progress } : {}),
      ...(coercedStatus !== undefined ? { status: coercedStatus } : {}),
      ...(completedCount !== undefined ? { completedCount } : {}),
      ...(input.lastReadNodeId !== undefined
        ? { lastReadNodeId: input.lastReadNodeId }
        : {}),
      ...(input.lastReadAnchor !== undefined
        ? { lastReadAnchor: input.lastReadAnchor ?? null }
        : {}),
      ...(input.extra !== undefined ? { extra: input.extra ?? null } : {}),
      ...(input.addTimeMs !== undefined
        ? { totalTimeMsIncrement: addTimeMs }
        : {}),
    };

    const row = await this.repository.upsertProgress({
      userId,
      unitId,
      create: createData,
      update: updateData,
    });

    await enqueueProgressSearch(
      SEARCH_COMMAND_KINDS.progressSync,
      row.userId,
      row.unitId,
    );

    return row;
  }

  async get(
    userId: string,
    unitId: string,
  ): Promise<UserUnitProgressRow | null> {
    const row = await this.repository.findProgress(userId, unitId);
    return row?.isDeleted ? null : row;
  }

  private async listRows(
    userId: string,
    query: ProgressListInput = {},
  ): Promise<ProgressPage> {
    const limit = Math.max(
      1,
      Math.min(Number(query.limit ?? DEFAULT_LIMIT), MAX_LIMIT),
    );
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const cursorDate = cursor ? new Date(cursor.lastSeenAt) : null;

    if (cursorDate && Number.isNaN(cursorDate.getTime())) {
      throw new AppError(400, "Invalid progress cursor");
    }

    const rows = await this.repository.listProgressRows({
      userId,
      cursorDate: cursorDate ?? null,
      cursorUnitId: cursor?.unitId ?? null,
      take: limit + 1,
    });

    const pageRows = rows.slice(0, limit);
    const last = pageRows.at(-1);
    const nextCursor =
      rows.length > limit && last
        ? encodeCursor({
            lastSeenAt: last.lastSeenAt.toISOString(),
            unitId: last.unitId,
          })
        : null;

    return { rows: pageRows, nextCursor };
  }

  async list(
    userId: string,
    query: ProgressListInput = {},
  ): Promise<UnitProgressListResponse> {
    const page = await this.listRows(userId, query);
    return {
      rows: page.rows.map(mapProgressToDTO),
      nextCursor: page.nextCursor,
    };
  }

  async listLibrary(
    userId: string,
    query: ProgressListInput = {},
  ): Promise<ProgressLibraryListResponse> {
    const page = await this.listRows(userId, query);
    if (page.rows.length === 0) {
      return { rows: [], nextCursor: null };
    }

    const unitIds = page.rows.map((row) => row.unitId);
    const unitIdSet = new Set(unitIds);
    const shelfRows = await this.repository.findShelfLinks(userId, unitIds);
    const shelvesByUnit = new Map<string, ProgressLibraryRow["shelves"]>();
    for (const shelfRow of shelfRows) {
      const linkedUnitIds = [
        unitIdSet.has(shelfRow.unitId) ? shelfRow.unitId : null,
        shelfRow.variantUnitId && unitIdSet.has(shelfRow.variantUnitId)
          ? shelfRow.variantUnitId
          : null,
      ].filter((unitId): unitId is string => Boolean(unitId));
      const link = {
        shelfUnitId: shelfRow.shelfId,
        title: pickTitle(shelfRow.shelf.unit) || shelfRow.shelfId,
      };
      for (const progressUnitId of new Set(linkedUnitIds)) {
        const shelves = shelvesByUnit.get(progressUnitId) ?? [];
        shelves.push(link);
        shelvesByUnit.set(progressUnitId, shelves);
      }
    }

    return {
      rows: page.rows.map((row): ProgressLibraryRow => {
        const unit = row.unit as unknown as UnitDisplay & {
          targetUnit?: UnitDisplay | null;
        };
        const lastReadNode =
          "lastReadNode" in row
            ? (row.lastReadNode as { isDeleted?: boolean } | null)
            : null;
        const lastReadNodeId =
          lastReadNode && !lastReadNode.isDeleted ? row.lastReadNodeId : null;

        return {
          progress: mapProgressToDTO(row),
          progressUnit: unitSummary(row.unitId, unit),
          mainUnitContext:
            unit.catalogEntryKind === "VARIANT" &&
            unit.targetUnitId &&
            unit.targetUnit
              ? unitSummary(unit.targetUnitId, unit.targetUnit)
              : null,
          // Progress rows are anchored to the exact unit the user touched.
          // Even when that unit is a VARIANT, resume routes keep that id.
          resumeRoute:
            unit.type === "BOOK"
              ? lastReadNodeId
                ? { kind: "node", bookId: row.unitId, nodeId: lastReadNodeId }
                : { kind: "book", bookId: row.unitId }
              : undefined,
          shelves: shelvesByUnit.get(row.unitId) ?? [],
        };
      }),
      nextCursor: page.nextCursor,
    };
  }

  async delete(userId: string, unitId: string): Promise<void> {
    await this.repository.softDeleteProgress(userId, unitId, new Date());

    await enqueueProgressSearch(
      SEARCH_COMMAND_KINDS.progressRemove,
      userId,
      unitId,
    );
  }

  async toggleNodeCompletion(
    userId: string,
    bookUnitId: string,
    nodeId: string,
    isCompleted: boolean,
  ): Promise<void> {
    const node = await this.repository.findContentNode(nodeId);
    if (!node) {
      throw new AppError(404, "Content structure node not found", {
        code: "content_structure_node_not_found",
      });
    }
    if (node.ownerUnitId !== bookUnitId) {
      throw new AppError(
        422,
        "Node does not belong to the specified book Unit",
        { code: "content_structure_node_cross_book" },
      );
    }
    if (node.isDeleted) {
      throw new AppError(409, "Cannot mark a deleted node as completed", {
        code: "content_structure_node_deleted",
      });
    }

    if (isCompleted) {
      await this.repository.upsertNodeCompletion(userId, nodeId);
    } else {
      await this.repository.deleteNodeCompletion(userId, nodeId);
    }
  }

  async progressStats(unitId: string): Promise<UnitProgressStatsResponse> {
    const response = await searchClient.progressIndex.search("", {
      filter: [`unitId = "${unitId}"`],
      facets: ["status", "progressBucket"],
      limit: 0,
    });
    const facets = response.facetDistribution ?? {};
    const statusFacet = facets.status as Record<string, number> | undefined;
    const bucketFacet = facets.progressBucket as
      | Record<string, number>
      | undefined;
    const statusCounts = Object.fromEntries(
      userUnitProgressStatusValues.map((status) => [
        status,
        readFacetCount(statusFacet, status),
      ]),
    ) as UnitProgressStatsResponse["statusCounts"];
    const bucketCounts = Array.from(
      { length: PROGRESS_BUCKET_COUNT },
      (_, bucket) => readFacetCount(bucketFacet, bucket),
    );

    return {
      viewerCount: response.estimatedTotalHits ?? response.hits.length,
      statusCounts,
      bucketCounts,
    };
  }
}

export const progressService = new ProgressService();
