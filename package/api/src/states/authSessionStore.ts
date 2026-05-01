import { authApi } from "@rezics/api/auth/auth.api";
import {
  clearAuthPresence,
  hasAuthPresence,
} from "@rezics/api/react-query/authPresence";
import {
  getRezicsSessionClaims,
  getToken,
  parseJwt,
} from "@rezics/api/react-query/jwt";
import type {
  AuthSession,
  AuthUser,
  GetSessionStateResponse,
  Permission,
} from "@rezics/contract";
import { NormalizedTokenName } from "@rezics/contract";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type AuthSessionHydrationStatus = "idle" | "loading" | "ready" | "error";

type AuthSessionSnapshot = {
  session: GetSessionStateResponse["session"] | null;
  user: GetSessionStateResponse["user"] | null;
  authSession: GetSessionStateResponse["authSession"];
};

export type AuthSessionStoreState = {
  status: AuthSessionHydrationStatus;
  session: AuthSession | null;
  user: AuthUser | null;
  authSession: GetSessionStateResponse["authSession"] | null;
  /**
   * Main server permission, derived from the `rezics-session-token` claims.
   *
   * This represents the main server's permission model and is unrelated to
   * `auth-session-token` except during the session exchange flow.
   *
   * `null` when the user has no valid session token (unauthenticated).
   */
  permission: Permission | null;
  /**
   * Main server actor unitId, derived from the `rezics-session-token` claims.
   * `null` when the user has no valid session token (unauthenticated).
   */
  unitId: string | null;
  identitySet: boolean;
  registrationComplete: boolean;
  error: string | null;
  setPending: () => void;
  setSessionState: (state: AuthSessionSnapshot | null) => void;
  clearSessionState: () => void;
  reset: () => void;
};

function deriveSessionClaims(): {
  permission: Permission | null;
  unitId: string | null;
} {
  const claims = getRezicsSessionClaims();
  if (!claims) return { permission: null, unitId: null };
  return {
    permission: claims.permission ?? null,
    unitId: typeof claims.unitId === "string" ? claims.unitId : null,
  };
}

function deriveState(
  snapshot: AuthSessionSnapshot | null,
  status: AuthSessionHydrationStatus = "ready",
  error: string | null = null,
) {
  const identitySet = Boolean(snapshot?.authSession?.identitySet);
  const emailVerified = Boolean(snapshot?.authSession?.emailVerified);
  const registrationComplete = identitySet && emailVerified;
  const { permission, unitId } = deriveSessionClaims();

  return {
    status,
    session: snapshot?.session ?? null,
    user: snapshot?.user ?? null,
    authSession: snapshot?.authSession ?? null,
    permission,
    unitId,
    identitySet,
    registrationComplete,
    error,
  };
}

const initialState = deriveState(null, "idle");

export const useAuthSessionStore = create<AuthSessionStoreState>()(
  devtools(
    (set) => ({
      ...initialState,
      setPending: () =>
        set((state) => ({
          ...state,
          status: "loading",
          error: null,
        })),
      setSessionState: (state) => set(deriveState(state, "ready")),
      clearSessionState: () => set(deriveState(null, "ready")),
      reset: () => set(deriveState(null, "idle")),
    }),
    { name: "authSessionStore", store: "authSessionStore" },
  ),
);

export async function hydrateAuthSessionState(options?: {
  requirePresence?: boolean;
}) {
  const store = useAuthSessionStore.getState();
  const token = getToken(NormalizedTokenName.AUTH_SESSION);
  const requiresPresence = options?.requirePresence ?? !token;

  if (requiresPresence && !hasAuthPresence()) {
    useAuthSessionStore.setState(deriveState(null, "ready"));
    return null;
  }

  store.setPending();

  try {
    // Always fetch full session state from server to get identity + email status
    const authToken = getToken(NormalizedTokenName.AUTH_SESSION);
    const payload = authToken ? parseJwt(authToken) : null;

    let authSession: GetSessionStateResponse["authSession"];
    try {
      const serverState = await authApi.getSessionState();
      authSession = serverState.authSession;
    } catch {
      // Fallback: derive from local token claims
      const emailVerified = payload?.email_verified !== false;
      const identitySet = Boolean(payload?.slug);
      authSession = {
        canAcquireMemberToken: identitySet && emailVerified,
        readinessStatus:
          identitySet && emailVerified ? "ready" : "needs-registration",
        emailVerified,
        identitySet,
        registrationComplete: identitySet && emailVerified,
      } as GetSessionStateResponse["authSession"];
    }

    const sessionState: AuthSessionSnapshot = {
      session: payload
        ? {
            id: payload.sub ?? "",
            userId: payload.sub ?? payload.id ?? "",
            token: authToken!,
            expiresAt: "",
          }
        : null,
      user: payload
        ? {
            id: payload.sub ?? payload.id ?? "",
            name: payload.name ?? "",
            role: payload.role ?? "user",
            email: "",
            emailVerified: payload.email_verified !== false,
            createdAt: "",
            updatedAt: "",
          }
        : null,
      authSession,
    };

    useAuthSessionStore.getState().setSessionState(sessionState);
    return sessionState;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown auth session error";
    clearAuthPresence();
    useAuthSessionStore.setState(deriveState(null, "error", message));
    return null;
  }
}

export function clearAuthSessionState() {
  useAuthSessionStore.getState().clearSessionState();
}
