import type { UnitProgressListResponse } from "@rezics/contract";
import type { Prisma, UserUnitProgress } from "#/prisma/client";
import { prisma, UserUnitProgressStatus } from "#/prisma/client";
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

    const createData: Prisma.UserUnitProgressCreateInput = {
      user: { connect: { unitId: userId } },
      unit: { connect: { id: unitId } },
      progress: input.progress ?? 0,
      status: coercedStatus ?? UserUnitProgressStatus.BACKLOG,
      totalTimeMs: addTimeMs,
      lastPosition: input.lastPosition ?? null,
      extra:
        input.extra !== undefined
          ? ((input.extra ?? null) as Prisma.InputJsonValue)
          : undefined,
      firstSeenAt: now,
      lastSeenAt: now,
    };

    const updateData: Prisma.UserUnitProgressUpdateInput = {
      lastSeenAt: now,
      ...(input.progress !== undefined ? { progress: input.progress } : {}),
      ...(coercedStatus !== undefined ? { status: coercedStatus } : {}),
      ...(input.lastPosition !== undefined
        ? { lastPosition: input.lastPosition }
        : {}),
      ...(input.extra !== undefined
        ? { extra: (input.extra ?? null) as Prisma.InputJsonValue }
        : {}),
      ...(input.addTimeMs !== undefined
        ? { totalTimeMs: { increment: addTimeMs } }
        : {}),
    };

    return prisma.userUnitProgress.upsert({
      where: { userId_unitId: { userId, unitId } },
      create: createData,
      update: updateData,
    });
  }

  async get(userId: string, unitId: string): Promise<UserUnitProgress | null> {
    return prisma.userUnitProgress.findUnique({
      where: { userId_unitId: { userId, unitId } },
    });
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
    await prisma.userUnitProgress.deleteMany({
      where: { userId, unitId },
    });
  }
}

export const progressService = new ProgressService();
