import type { Permission } from "@rezics/contract";
import { useAuthSessionStore } from "../states/authSessionStore";

/**
 * Returns the current user's permission on the main server,
 * derived from the `rezics-session-token` claims.
 *
 * This represents the main server's permission model and is
 * unrelated to `auth-session-token` except during the
 * session exchange flow.
 *
 * Returns `null` when the user has no valid session token
 * (unauthenticated).
 */
export function useServerPermission(): Permission | null {
  return useAuthSessionStore((s) => s.permission);
}
