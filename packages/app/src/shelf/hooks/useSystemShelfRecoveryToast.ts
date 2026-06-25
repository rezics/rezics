import {
  getSystemShelfMissingSlug,
  useSystemShelfRecovery,
} from "@rezics/contract/api/shelf/useSystemShelfRecovery";
import { FAVORITES_SHELF_SLUG, type ReservedShelfSlug } from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { toast } from "sonner";

const SYSTEM_SHELF_RECOVERY_LABEL_KEY = {
  [FAVORITES_SHELF_SLUG]: "entity:shelf_system_favorites",
} as const satisfies Record<ReservedShelfSlug, `entity:${string}`>;

export type SystemShelfRecoveryToast = {
  /**
   * Surface the recovery toast for the given system shelf. The toast has a
   * `[Retry]` action that calls `POST /shelf/system/ensure` exactly once.
   * The original mutation is NOT auto-retried; the user re-clicks the
   * source action themselves.
   */
  showRecoveryToast: (slug: ReservedShelfSlug) => void;
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

  const showRecoveryToast = (slug: ReservedShelfSlug): void => {
    const toastId = toast.error(
      getI18nRuntime().i18n.t("entity:shelf_system_recoveryToast", {
        kind: getI18nRuntime().i18n.t(SYSTEM_SHELF_RECOVERY_LABEL_KEY[slug]),
      }),
      {
        action: {
          label: getI18nRuntime().i18n.t("entity:shelf_system_recoveryRetry"),
          onClick: () => {
            recovery.ensure(slug).then(
              () => toast.dismiss(toastId),
              () => showRecoveryToast(slug),
            );
          },
        },
      },
    );
  };

  const handleError = (error: unknown): boolean => {
    const slug = getSystemShelfMissingSlug(error);
    if (!slug) return false;
    showRecoveryToast(slug);
    return true;
  };

  return { showRecoveryToast, handleError };
}
