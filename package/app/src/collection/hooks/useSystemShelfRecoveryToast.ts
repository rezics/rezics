import { useEnsureSystemShelf } from "@rezics/api/shelf";
import { ApiError } from "@rezics/api/react-query/errors";
import type { SystemShelfKindKey } from "@rezics/contract";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const SYSTEM_KINDS: ReadonlySet<SystemShelfKindKey> = new Set([
  "favorites",
  "backlog",
  "active",
  "completed",
]);

function isSystemKindKey(value: unknown): value is SystemShelfKindKey {
  return typeof value === "string" && SYSTEM_KINDS.has(value as SystemShelfKindKey);
}

/**
 * Parse a thrown error and return its `kindKey` if the server reported
 * `system_shelf_missing`; otherwise return null.
 */
export function getSystemShelfMissingKindKey(
  error: unknown,
): SystemShelfKindKey | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code !== "system_shelf_missing") return null;
  return isSystemKindKey(error.detail?.kindKey) ? error.detail.kindKey : null;
}

export type SystemShelfRecoveryToast = {
  /**
   * Surface the recovery toast for the given system shelf. The toast has a
   * `[Retry]` action that calls `POST /shelf/system/ensure` exactly once.
   * The original mutation is NOT auto-retried; the user re-clicks the
   * source action themselves.
   */
  showRecoveryToast: (kindKey: SystemShelfKindKey) => void;
  /**
   * Convenience wrapper for mutation `onError`: if the error is a
   * `system_shelf_missing` AppError, surface the recovery toast and return
   * `true`. Otherwise return `false` so the caller can fall through to its
   * default error handling.
   */
  handleError: (error: unknown) => boolean;
};

export function useSystemShelfRecoveryToast(): SystemShelfRecoveryToast {
  const { t } = useTranslation();
  const ensureMutation = useEnsureSystemShelf();
  const inFlight = useRef(new Set<SystemShelfKindKey>());

  const showRecoveryToast = (kindKey: SystemShelfKindKey): void => {
    if (inFlight.current.has(kindKey)) return;
    const kindLabel = t(`shelf.system.${kindKey}`);
    const toastId = toast.error(
      t("shelf.system.recoveryToast", { kind: kindLabel }),
      {
        action: {
          label: t("shelf.system.recoveryRetry"),
          onClick: () => {
            if (inFlight.current.has(kindKey)) return;
            inFlight.current.add(kindKey);
            ensureMutation.mutate(kindKey, {
              onSuccess: () => {
                inFlight.current.delete(kindKey);
                toast.dismiss(toastId);
              },
              onError: () => {
                inFlight.current.delete(kindKey);
                // Second toast surfaces with the same retry action.
                showRecoveryToast(kindKey);
              },
            });
          },
        },
      },
    );
  };

  const handleError = (error: unknown): boolean => {
    const kindKey = getSystemShelfMissingKindKey(error);
    if (!kindKey) return false;
    showRecoveryToast(kindKey);
    return true;
  };

  return { showRecoveryToast, handleError };
}
