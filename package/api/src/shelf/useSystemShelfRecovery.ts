import type {
  EnsureSystemShelfResponse,
  SystemShelfKindKey,
} from "@rezics/contract";
import { SYSTEM_SHELF_KIND_KEYS } from "@rezics/contract";
import { useCallback, useRef } from "react";
import { ApiError } from "../react-query/errors";
import { useEnsureSystemShelf } from "./useEnsureSystemShelf";

const SYSTEM_KIND_KEYS: ReadonlySet<SystemShelfKindKey> = new Set(
  SYSTEM_SHELF_KIND_KEYS,
);

export function isSystemShelfKindKey(
  value: unknown,
): value is SystemShelfKindKey {
  return (
    typeof value === "string" &&
    SYSTEM_KIND_KEYS.has(value as SystemShelfKindKey)
  );
}

/**
 * Parse a thrown error and return its `kindKey` if the server reported a
 * recoverable missing system shelf.
 */
export function getSystemShelfMissingKindKey(
  error: unknown,
): SystemShelfKindKey | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code !== "system_shelf_missing") return null;
  return isSystemShelfKindKey(error.detail?.kindKey)
    ? error.detail.kindKey
    : null;
}

export type UseSystemShelfRecoveryResult = {
  ensure: (kindKey: SystemShelfKindKey) => Promise<EnsureSystemShelfResponse>;
  ensureFromError: (
    error: unknown,
  ) => Promise<EnsureSystemShelfResponse | null>;
  isPending: boolean;
};

/**
 * Shared recovery primitive for the rare orphan state where one of the
 * viewer's system shelves is missing.
 *
 * Requests are single-flight per `kindKey`: concurrent callers share the same
 * ensure promise, so one user action cannot fan out duplicate recovery calls.
 */
export function useSystemShelfRecovery(): UseSystemShelfRecoveryResult {
  const { mutateAsync: ensureSystemShelf, isPending } = useEnsureSystemShelf();
  const inFlight = useRef(
    new Map<SystemShelfKindKey, Promise<EnsureSystemShelfResponse>>(),
  );

  const ensure = useCallback(
    (kindKey: SystemShelfKindKey): Promise<EnsureSystemShelfResponse> => {
      const pending = inFlight.current.get(kindKey);
      if (pending) return pending;

      const promise = ensureSystemShelf(kindKey).finally(() =>
        inFlight.current.delete(kindKey),
      );
      inFlight.current.set(kindKey, promise);
      return promise;
    },
    [ensureSystemShelf],
  );

  const ensureFromError = useCallback(
    async (error: unknown): Promise<EnsureSystemShelfResponse | null> => {
      const kindKey = getSystemShelfMissingKindKey(error);
      return kindKey ? ensure(kindKey) : null;
    },
    [ensure],
  );

  return {
    ensure,
    ensureFromError,
    isPending,
  };
}
