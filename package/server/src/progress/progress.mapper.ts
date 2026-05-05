import type { UnitProgressRowDTO } from "@rezics/contract";
import type { UserUnitProgress } from "#/prisma/client";

export function mapProgressToDTO(row: UserUnitProgress): UnitProgressRowDTO {
  return {
    userId: row.userId,
    unitId: row.unitId,
    progress: row.progress,
    status: row.status,
    totalTimeMs: Number(row.totalTimeMs),
    lastPosition: row.lastPosition,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    extra: (row.extra as Record<string, unknown> | null) ?? null,
  };
}
