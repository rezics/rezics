import {
  PROGRESS_EXTRA_KNOWN_KEYS,
  type UnitProgressListResponse,
  type UnitProgressStatsResponse,
  userUnitProgressStatusValues,
} from "@rezics/contract";
import {
  PROGRESS_BUCKET_COUNT,
  removeProgress,
  syncProgress,
} from "@rezics/search";
import type { Prisma, UserUnitProgress } from "#/prisma/client";
import { prisma, UserUnitProgressStatus } from "#/prisma/client";
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

    const createData: Prisma.UserUnitProgressCreateInput = {
      user: { connect: { userId } },
      unit: { connect: { id: unitId } },
      progress: input.progress ?? 0,
      status: coercedStatus ?? UserUnitProgressStatus.BACKLOG,
      isDeleted: false,
      completedCount:
        completedCount ??
        (coercedStatus === UserUnitProgressStatus.COMPLETED ? 1 : 0),
      totalTimeMs: addTimeMs,
      lastPosition: (input.lastPosition ?? null) as Prisma.InputJsonValue,
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
      ...(input.lastPosition !== undefined
        ? {
            lastPosition: (input.lastPosition ?? null) as Prisma.InputJsonValue,
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

    void syncProgress(searchClient, row);

    return row;
  }

  async get(userId: string, unitId: string): Promise<UserUnitProgress | null> {
    return prisma.userUnitProgress
      .findUnique({
        where: { userId_unitId: { userId, unitId } },
      })
      .then((row) => (row?.isDeleted ? null : row));
  }

  async list(
    userId: string,
    query: ProgressListInput = {},
  ): Promise<UnitProgressListResponse> {
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

    return {
      rows: pageRows.map(mapProgressToDTO),
      nextCursor,
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

    void removeProgress(searchClient, userId, unitId);
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
