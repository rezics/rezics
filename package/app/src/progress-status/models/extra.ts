import type { ProgressExtra, UserUnitProgressStatus } from "@rezics/contract";

export type { ProgressExtra };

export type ReasonStatus = Extract<
  UserUnitProgressStatus,
  "PAUSED" | "DROPPED"
>;

const STATUS_TO_EXTRA_KEY = {
  PAUSED: "paused",
  DROPPED: "dropped",
} as const satisfies Record<ReasonStatus, "paused" | "dropped">;

export function getReasonPostIds(
  extra: ProgressExtra | null | undefined,
  status: ReasonStatus,
): string[] {
  const key = STATUS_TO_EXTRA_KEY[status];
  const bucket = extra?.[key];
  return bucket?.reasonPostUnitIds ?? [];
}

export function getLatestReasonPostId(
  extra: ProgressExtra | null | undefined,
  status: ReasonStatus,
): string | null {
  const ids = getReasonPostIds(extra, status);
  return ids.length > 0 ? ids[ids.length - 1] : null;
}

export function appendReasonPostId(
  extra: ProgressExtra | null | undefined,
  status: ReasonStatus,
  postUnitId: string,
): ProgressExtra {
  const key = STATUS_TO_EXTRA_KEY[status];
  const existing = getReasonPostIds(extra, status);
  return {
    ...(extra ?? {}),
    [key]: { reasonPostUnitIds: [...existing, postUnitId] },
  };
}
