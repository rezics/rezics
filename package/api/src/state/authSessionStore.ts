import {
  clearAuthPresence,
  hasAuthPresence,
} from "@rezics/api/react-query/authPresence";
import { getToken, parseJwt } from "@rezics/api/react-query/jwt";
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

type AuthSessionSnapshot = Pick<
  GetSessionStateResponse,
  "session" | "user" | "authSession"
>;

export type AuthSessionStoreState = {
  status: AuthSessionHydrationStatus;
  session: AuthSession | null;
  user: AuthUser | null;
  authSession: GetSessionStateResponse["authSession"] | null;
  /**
   * Main server permission, derived from the `rezics-session-token` claims.
   *
   * This represents the main server's permission model and is unrelated to
   * `auth-identity-token` except during the session exchange flow.
   *
   * `null` when the user has no valid session token (unauthenticated).
   */
  permission: Permission | null;
  needsVerification: boolean;
  needsOnboarding: boolean;
  error: string | null;
  setPending: () => void;
  setSessionState: (state: AuthSessionSnapshot | null) => void;
  clearSessionState: () => void;
  reset: () => void;
};

function deriveNeedsVerification(): boolean {
  const token = getToken(NormalizedTokenName.AUTH_IDENTITY);
  if (!token) return false;
  const payload = parseJwt(token);
  return payload?.email_verified === false;
}

function derivePermission(): Permission | null {
  const sessionToken = getToken(NormalizedTokenName.REZICS_SESSION);
  if (!sessionToken) return null;
  const payload = parseJwt(sessionToken);
  return payload?.permission ?? null;
}

function deriveState(
  snapshot: AuthSessionSnapshot | null,
  status: AuthSessionHydrationStatus = "ready",
  error: string | null = null,
) {
  const needsVerification = deriveNeedsVerification();
  const needsOnboarding = Boolean(snapshot?.authSession?.needsOnboarding);
  const permission = derivePermission();

  return {
    status,
    session: snapshot?.session ?? null,
    user: snapshot?.user ?? null,
    authSession: snapshot?.authSession ?? null,
    permission,
    needsVerification,
    needsOnboarding,
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
  const token = getToken(NormalizedTokenName.AUTH_IDENTITY);
  const requiresPresence = options?.requirePresence ?? !token;

  if (requiresPresence && !hasAuthPresence()) {
    useAuthSessionStore.setState(deriveState(null, "ready"));
    return null;
  }

  store.setPending();

  try {
    // Derive state from local token claims — no server call needed
    const authToken = getToken(NormalizedTokenName.AUTH_IDENTITY);
    const payload = authToken ? parseJwt(authToken) : null;

    const sessionState: AuthSessionSnapshot = {
      session: payload
        ? { id: payload.sub ?? "", token: authToken!, expiresAt: "" }
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
      authSession: {
        canAcquireMemberToken: !!payload,
        readinessStatus: payload?.email_verified === false
          ? "needs-verification"
          : "ready",
      } as GetSessionStateResponse["authSession"],
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
