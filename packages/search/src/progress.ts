export const PROGRESS_BUCKET_COUNT = 10;

export const PROGRESS_INDEX_NAME = "user_unit_progress";

export interface UserUnitProgressRow {
  id: string;
  userId: string;
  unitId: string;
  progress: number;
  status: string;
  lastSeenAt: Date | string | number;
}

export interface UserUnitProgressDocument {
  id: string;
  progressId: string;
  userId: string;
  unitId: string;
  status: string;
  progressBucket: number;
  lastSeenAt: number;
}

export function progressDocumentId(userId: string, unitId: string): string {
  return `${userId}:${unitId}`;
}

export function bucketize(progress: number): number {
  const normalized = Number.isFinite(progress) ? progress : 0;
  const clamped = Math.max(0, Math.min(1, normalized));
  return Math.min(
    PROGRESS_BUCKET_COUNT - 1,
    Math.floor(clamped * PROGRESS_BUCKET_COUNT),
  );
}

export function toUnixSeconds(value: Date | string | number): number {
  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000);
  }

  if (typeof value === "number") {
    return Math.floor(value / 1000);
  }

  return Math.floor(new Date(value).getTime() / 1000);
}

export function buildProgressDocument(
  row: UserUnitProgressRow,
): UserUnitProgressDocument {
  return {
    id: progressDocumentId(row.userId, row.unitId),
    progressId: row.id,
    userId: row.userId,
    unitId: row.unitId,
    status: row.status,
    progressBucket: bucketize(row.progress),
    lastSeenAt: toUnixSeconds(row.lastSeenAt),
  };
}
