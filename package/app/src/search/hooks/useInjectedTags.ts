import { useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import type { InjectedTag } from "../models/injectedTags";

/**
 * Read `injectedTags` from TanStack Router's location state.
 * Returns the array when present (navigation-provided), or `undefined`
 * when absent (shared URL, refresh, or direct navigation).
 *
 * The state is captured on mount so it remains stable across re-renders
 * until the user navigates again.
 */
export function useInjectedTags(): InjectedTag[] | undefined {
  const state = useRouterState({
    select: (s) => s.location.state as { injectedTags?: InjectedTag[] } | undefined,
  });
  return useMemo(() => state?.injectedTags, [state?.injectedTags]);
}
