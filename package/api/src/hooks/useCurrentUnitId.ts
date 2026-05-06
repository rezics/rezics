import { useAuthSessionStore } from "../states/authSessionStore";

/**
 * Returns the current user's actor `userId`, derived from server-hydrated
 * session state.
 *
 * Returns `null` when the user has no valid main session.
 */
export function useCurrentUnitId(): string | null {
  return useAuthSessionStore((s) => s.unitId);
}
