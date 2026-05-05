import { useAuthSessionStore } from "../states/authSessionStore";

/**
 * Returns the current user's actor `userId`, derived from the
 * `rezics-session-token` claims.
 *
 * Returns `null` when the user has no valid session token (unauthenticated).
 */
export function useCurrentUnitId(): string | null {
  return useAuthSessionStore((s) => s.unitId);
}
