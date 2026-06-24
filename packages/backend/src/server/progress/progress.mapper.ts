import {
  type LastReadAnchor,
  type ProgressPostLinkDTO,
  type UnitProgressRowDTO,
} from "@rezics/contract";
import type { UserUnitProgress, UserUnitProgressPost } from "../db/schema";

export type ProgressStorageRow = Omit<
  typeof UserUnitProgress.$inferSelect,
  "totalTimeMs"
> & {
  totalTimeMs: number | bigint;
};

function sanitizeAnchor(raw: unknown): LastReadAnchor | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const text = (raw as { text?: unknown }).text;
  if (typeof text !== "string" || text.length === 0 || text.length > 200) {
    return null;
  }
  return { text };
}

export function mapProgressToDTO(row: ProgressStorageRow): UnitProgressRowDTO {
  return {
    userId: row.userId,
    unitId: row.unitId,
    progress: row.progress,
    status: row.status,
    isDeleted: row.isDeleted,
    completedCount: row.completedCount,
    totalTimeMs: Number(row.totalTimeMs),
    lastReadNodeId: row.lastReadNodeId ?? null,
    lastReadAnchor: sanitizeAnchor(row.lastReadAnchor),
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
  };
}

export function mapProgressPostLinkToDTO(
  row: typeof UserUnitProgressPost.$inferSelect,
): ProgressPostLinkDTO {
  return {
    progressId: row.progressId,
    postUnitId: row.postUnitId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}
