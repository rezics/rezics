import type {
  EnsureSystemShelfResponse,
  ReservedShelfSlug,
} from "@rezics/contract";
import { RESERVED_SHELF_SLUGS } from "@rezics/contract";
import { useCallback, useRef } from "react";
import { ApiError } from "../react-query/errors";
import { useEnsureSystemShelf } from "./useEnsureSystemShelf";

const RESERVED_SLUGS: ReadonlySet<ReservedShelfSlug> = new Set(
  RESERVED_SHELF_SLUGS,
);

export function isReservedShelfSlug(
  value: unknown,
): value is ReservedShelfSlug {
  return (
    typeof value === "string" && RESERVED_SLUGS.has(value as ReservedShelfSlug)
  );
}

/**
 * Parse a thrown error and return its reserved `slug` if the server reported a
 * recoverable missing system shelf.
 */
export function getSystemShelfMissingSlug(
  error: unknown,
): ReservedShelfSlug | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code !== "system_shelf_missing") return null;
  return isReservedShelfSlug(error.detail?.slug) ? error.detail.slug : null;
}

export type UseSystemShelfRecoveryResult = {
  ensure: (slug: ReservedShelfSlug) => Promise<EnsureSystemShelfResponse>;
  ensureFromError: (
    error: unknown,
  ) => Promise<EnsureSystemShelfResponse | null>;
  isPending: boolean;
};

/**
 * Shared recovery primitive for the rare orphan state where one of the
 * viewer's system shelves is missing.
 *
 * Requests are single-flight per reserved slug: concurrent callers share the same
 * ensure promise, so one user action cannot fan out duplicate recovery calls.
 */
export function useSystemShelfRecovery(): UseSystemShelfRecoveryResult {
  const { mutateAsync: ensureSystemShelf, isPending } = useEnsureSystemShelf();
  const inFlight = useRef(
    new Map<ReservedShelfSlug, Promise<EnsureSystemShelfResponse>>(),
  );

  const ensure = useCallback(
    (slug: ReservedShelfSlug): Promise<EnsureSystemShelfResponse> => {
      const pending = inFlight.current.get(slug);
      if (pending) return pending;

      const promise = ensureSystemShelf(slug).finally(() =>
        inFlight.current.delete(slug),
      );
      inFlight.current.set(slug, promise);
      return promise;
    },
    [ensureSystemShelf],
  );

  const ensureFromError = useCallback(
    async (error: unknown): Promise<EnsureSystemShelfResponse | null> => {
      const slug = getSystemShelfMissingSlug(error);
      return slug ? ensure(slug) : null;
    },
    [ensure],
  );

  return {
    ensure,
    ensureFromError,
    isPending,
  };
}
