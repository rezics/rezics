import type { LockedFieldRejection, LockFieldKey } from "@rezics/contract";

export interface ApiErrorDetail {
  prisma?: {
    code: string;
    model?: string;
    target?: string[];
  };
  /** Set when `code === "system_shelf_missing"`. */
  kindKey?: string;
  blockedFieldKeys?: LockFieldKey[];
  locks?: LockedFieldRejection["locks"];
  unitId?: string;
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
  blockedFieldKeys: LockFieldKey[];
  locks?: LockedFieldRejection["locks"];
  message: string;
}

export function getLockedFieldError(
  error: unknown,
): LockedFieldApiError | null {
  if (!(error instanceof ApiError) || error.code !== "FIELD_LOCKED") {
    return null;
  }

  const blockedFieldKeys = error.detail?.blockedFieldKeys;
  if (!blockedFieldKeys?.length) {
    return { message: error.message, blockedFieldKeys: [] };
  }

  return {
    unitId: error.detail?.unitId,
    blockedFieldKeys,
    locks: error.detail?.locks,
    message: error.message,
  };
}
