import { getI18nRuntime } from "@rezics/i18n/runtime";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

export type ShowRetryToast = (
  retryKey: string,
  message: string,
  retry: () => Promise<void>,
) => void;

/**
 * Surfaces a non-blocking error toast with a "Retry" action that re-runs the
 * exact same payload. Used by user-triggered mutations (collect, follow, react,
 * send DM) so a transient or offline failure does not force the user to
 * re-enter input. Concurrent retries are de-duplicated by `retryKey`.
 */
export function useRetryToast(): ShowRetryToast {
  const inFlight = useRef(new Set<string>());

  return useCallback(
    (retryKey: string, message: string, retry: () => Promise<void>) => {
      if (inFlight.current.has(retryKey)) return;
      toast.error(message, {
        action: {
          label: getI18nRuntime().i18n.t("common:retry"),
          onClick: () => {
            if (inFlight.current.has(retryKey)) return;
            inFlight.current.add(retryKey);
            retry().finally(() => {
              inFlight.current.delete(retryKey);
            });
          },
        },
      });
    },
    [],
  );
}
