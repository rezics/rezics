import type { LockedFieldRejection } from "@rezics/contract";

export interface ApiErrorDetail {
  database?: {
    code: string;
    table?: string;
    constraint?: string;
  };
  /** Set when `code === "system_shelf_missing"`. 当 `code === "system_shelf_missing"` 时设置。 */
  slug?: string;
  blockedPaths?: string[];
  offendingLockPath?: string;
  offendingPatchPath?: string;
  locks?: LockedFieldRejection["locks"];
  unitId?: string;
  useApi?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly detail?: ApiErrorDetail,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface LockedFieldApiError {
  unitId?: string;
  blockedPaths: string[];
  offendingLockPath?: string;
  offendingPatchPath?: string;
  locks?: LockedFieldRejection["locks"];
  message: string;
}

export function getLockedFieldError(
  error: unknown,
): LockedFieldApiError | null {
  if (!(error instanceof ApiError) || error.code !== "FIELD_LOCKED") {
    return null;
  }

  const blockedPaths = error.detail?.blockedPaths;
  if (!blockedPaths?.length) {
    return { message: error.message, blockedPaths: [] };
  }

  return {
    unitId: error.detail?.unitId,
    blockedPaths,
    offendingLockPath: error.detail?.offendingLockPath,
    offendingPatchPath: error.detail?.offendingPatchPath,
    locks: error.detail?.locks,
    message: error.message,
  };
}
