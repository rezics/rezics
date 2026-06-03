import {
  type LastReadAnchor,
  PROGRESS_EXTRA_KNOWN_KEYS,
  type ProgressExtra,
  type UnitProgressRowDTO,
} from "@rezics/contract";
import type { UserUnitProgress } from "#/prisma/client";

function sanitizeAnchor(raw: unknown): LastReadAnchor | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const text = (raw as { text?: unknown }).text;
  if (typeof text !== "string" || text.length === 0 || text.length > 200) {
    return null;
  }
  return { text };
}

function sanitizeExtra(raw: unknown): ProgressExtra | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const out: ProgressExtra = {};
  for (const key of PROGRESS_EXTRA_KNOWN_KEYS) {
    const value = source[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Array.isArray(
        (value as { reasonPostUnitIds?: unknown }).reasonPostUnitIds,
      )
    ) {
      const ids = (value as { reasonPostUnitIds: unknown[] }).reasonPostUnitIds;
      if (ids.every((id) => typeof id === "string")) {
        out[key] = { reasonPostUnitIds: ids as string[] };
      }
    }
  }
  return out;
}

export function mapProgressToDTO(row: UserUnitProgress): UnitProgressRowDTO {
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
    extra: sanitizeExtra(row.extra),
  };
}
