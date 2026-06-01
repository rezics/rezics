import {
  PROGRESS_EXTRA_KNOWN_KEYS,
  type ProgressLibraryListResponse,
  type ProgressLibraryRow,
  type UnitProgressListResponse,
  type UnitProgressStatsResponse,
  readCoverUrlFromExtra,
  userUnitProgressStatusValues,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { PROGRESS_BUCKET_COUNT } from "@rezics/search";
import type { Prisma, UserUnitProgress } from "#/prisma/client";
import { prisma, UserUnitProgressStatus } from "#/prisma/client";
import { serverJobProducer } from "@/job/job-boundary";
import { searchClient } from "@/meili/search-client";
import { AppError } from "@/utils/errors";
import { mapProgressToDTO } from "./progress.mapper";
import type {
  ProgressCursor,
  ProgressListInput,
  ProgressUpsertInput,
} from "./progress.types";
import { progressStatusMap } from "./progress.types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type TranslationRow = {
  language: string;
  title: string | null;
  extra?: unknown;
};

type UnitDisplay = {
  defaultLanguage: string | null;
  translations: TranslationRow[];
};

type ProgressPage = {
  rows: (UserUnitProgress & {
    unit?: UnitDisplay & { type: ProgressLibraryRow["unit"]["unitType"] };
    lastReadNode?: { isDeleted: boolean } | null;
  })[];
  nextCursor: string | null;
};

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
function pickTitle(unit: UnitDisplay): string {
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
function pickCover(unit: UnitDisplay): string | undefined {
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

export class ProgressService {
  async upsert(
    userId: string,
    unitId: string,
    input: ProgressUpsertInput,
  ): Promise<UserUnitProgress> {
    validateInput(input);

    const now = new Date();
    const addTimeMs = BigInt(input.addTimeMs ?? 0);
    const coercedStatus =
      input.status === undefined && input.progress !== undefined
        ? input.progress >= 1
          ? UserUnitProgressStatus.COMPLETED
          : undefined
        : input.status !== undefined
          ? progressStatusMap[input.status]
          : undefined;
    const existing =
      coercedStatus === UserUnitProgressStatus.COMPLETED ||
      input.completedCount !== undefined
        ? await prisma.userUnitProgress.findUnique({
            where: { userId_unitId: { userId, unitId } },
            select: { status: true, completedCount: true },
          })
        : null;
    const isCompletionTransition =
      coercedStatus === UserUnitProgressStatus.COMPLETED &&
      existing?.status !== UserUnitProgressStatus.COMPLETED;
    const completedCount =
      input.completedCount !== undefined
        ? input.completedCount
        : isCompletionTransition
          ? (existing?.completedCount ?? 0) + 1
          : undefined;

    if (input.lastReadNodeId) {
      const node = await prisma.contentStructureNode.findUnique({
        where: { id: input.lastReadNodeId },
        select: { isDeleted: true, ownerUnitId: true },
      });
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

    const createData: Prisma.UserUnitProgressCreateInput = {
      user: { connect: { unitId: userId } },
      unit: { connect: { id: unitId } },
      progress: input.progress ?? 0,
      status: coercedStatus ?? UserUnitProgressStatus.BACKLOG,
      isDeleted: false,
      completedCount:
        completedCount ??
        (coercedStatus === UserUnitProgressStatus.COMPLETED ? 1 : 0),
      totalTimeMs: addTimeMs,
      ...(input.lastReadNodeId
        ? { lastReadNode: { connect: { id: input.lastReadNodeId } } }
        : {}),
      lastReadAnchor:
        input.lastReadAnchor !== undefined
          ? ((input.lastReadAnchor ?? null) as Prisma.InputJsonValue)
          : undefined,
      extra:
        input.extra !== undefined
          ? ((input.extra ?? null) as Prisma.InputJsonValue)
          : undefined,
      firstSeenAt: now,
      lastSeenAt: now,
    };

    const updateData: Prisma.UserUnitProgressUpdateInput = {
      lastSeenAt: now,
      isDeleted: false,
      ...(input.progress !== undefined ? { progress: input.progress } : {}),
      ...(coercedStatus !== undefined ? { status: coercedStatus } : {}),
      ...(completedCount !== undefined ? { completedCount } : {}),
      ...(input.lastReadNodeId !== undefined
        ? input.lastReadNodeId === null
          ? { lastReadNode: { disconnect: true } }
          : { lastReadNode: { connect: { id: input.lastReadNodeId } } }
        : {}),
      ...(input.lastReadAnchor !== undefined
        ? {
            lastReadAnchor: (input.lastReadAnchor ??
              null) as Prisma.InputJsonValue,
          }
        : {}),
      ...(input.extra !== undefined
        ? { extra: (input.extra ?? null) as Prisma.InputJsonValue }
        : {}),
      ...(input.addTimeMs !== undefined
        ? { totalTimeMs: { increment: addTimeMs } }
        : {}),
    };

    const row = await prisma.userUnitProgress.upsert({
      where: { userId_unitId: { userId, unitId } },
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

  async get(userId: string, unitId: string): Promise<UserUnitProgress | null> {
    return prisma.userUnitProgress
      .findUnique({
        where: { userId_unitId: { userId, unitId } },
      })
      .then((row) => (row?.isDeleted ? null : row));
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

    const rows = await prisma.userUnitProgress.findMany({
      where: {
        userId,
        isDeleted: false,
        ...(cursor && cursorDate
          ? {
              OR: [
                { lastSeenAt: { lt: cursorDate } },
                {
                  lastSeenAt: cursorDate,
                  unitId: { lt: cursor.unitId },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ lastSeenAt: "desc" }, { unitId: "desc" }],
      take: limit + 1,
      include: {
        unit: {
          select: {
            type: true,
            defaultLanguage: true,
            translations: {
              select: { language: true, title: true, extra: true },
            },
          },
        },
        lastReadNode: { select: { isDeleted: true } },
      },
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
    const shelfRows = await prisma.shelfUnit.findMany({
      where: {
        unitId: { in: unitIds },
        shelf: { unit: { userId } },
      },
      select: {
        unitId: true,
        shelfId: true,
        shelf: {
          select: {
            unit: {
              select: {
                defaultLanguage: true,
                translations: { select: { language: true, title: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    const shelvesByUnit = new Map<string, ProgressLibraryRow["shelves"]>();
    for (const shelfRow of shelfRows) {
      const shelves = shelvesByUnit.get(shelfRow.unitId) ?? [];
      shelves.push({
        shelfUnitId: shelfRow.shelfId,
        title: pickTitle(shelfRow.shelf.unit) || shelfRow.shelfId,
      });
      shelvesByUnit.set(shelfRow.unitId, shelves);
    }

    return {
      rows: page.rows.map((row): ProgressLibraryRow => {
        const unit = row.unit as unknown as UnitDisplay & {
          type: ProgressLibraryRow["unit"]["unitType"];
        };
        const lastReadNode =
          "lastReadNode" in row
            ? (row.lastReadNode as { isDeleted?: boolean } | null)
            : null;
        const lastReadNodeId =
          lastReadNode && !lastReadNode.isDeleted ? row.lastReadNodeId : null;

        return {
          progress: mapProgressToDTO(row),
          unit: {
            unitId: row.unitId,
            title: pickTitle(unit) || row.unitId,
            coverUrl: pickCover(unit),
            unitType: unit.type,
          },
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
    await prisma.userUnitProgress.updateMany({
      where: { userId, unitId },
      data: {
        isDeleted: true,
        lastSeenAt: new Date(),
      },
    });

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
    const node = await prisma.contentStructureNode.findUnique({
      where: { id: nodeId },
      select: { ownerUnitId: true, isDeleted: true },
    });
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
      await prisma.userContentNodeProgress.upsert({
        where: { userId_nodeId: { userId, nodeId } },
        create: { userId, nodeId },
        update: {},
      });
    } else {
      await prisma.userContentNodeProgress.deleteMany({
        where: { userId, nodeId },
      });
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
