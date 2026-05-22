import {
  getSystemShelfMissingKindKey,
  useSystemShelfRecovery,
} from "@rezics/api/shelf";
import type { SystemShelfKindKey } from "@rezics/contract";
import { systemShelfKindLabel } from "@/shelf/models/systemShelfLabel";
import { toast } from "sonner";
import * as m from "@rezics/i18n/messages";

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
  const recovery = useSystemShelfRecovery();

  const showRecoveryToast = (kindKey: SystemShelfKindKey): void => {
    const kindLabel = systemShelfKindLabel(kindKey);
    const toastId = toast.error(
      m.shelf_system_recoveryToast({ kind: kindLabel }),
      {
        action: {
          label: m.shelf_system_recoveryRetry(),
          onClick: () => {
            recovery.ensure(kindKey).then(
              () => toast.dismiss(toastId),
              () => showRecoveryToast(kindKey),
            );
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
