import { authApi } from "@rezics/api/auth/auth.api";
import {
  clearAuthPresence,
  hasAuthPresence,
} from "@rezics/api/react-query/authPresence";
import type {
  AuthSession,
  AuthUser,
  GetSessionStateResponse,
  Permission,
} from "@rezics/contract";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type AuthSessionHydrationStatus = "idle" | "loading" | "ready" | "error";
export type AuthCapabilityLevel = "anonymous" | "member";

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
   * Main server permission as represented by server-hydrated session state.
   * `null` when the user has no valid main session.
   */
  permission: Permission | null;
  capabilityLevel: AuthCapabilityLevel;
  hasAuthSession: boolean;
  needsVerification: boolean;
  /**
   * Main server actor userId from server-hydrated session state.
   * The field name remains `unitId` as a temporary compatibility alias.
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

function deriveState(
  snapshot: AuthSessionSnapshot | null,
  status: AuthSessionHydrationStatus = "ready",
  error: string | null = null,
) {
  const identitySet = Boolean(snapshot?.authSession?.identitySet);
  const emailVerified = Boolean(snapshot?.authSession?.emailVerified);
  const registrationComplete = identitySet && emailVerified;
  const role = snapshot?.user?.role?.toUpperCase();
  const permission =
    snapshot?.authSession?.canAcquireMemberToken || registrationComplete
      ? ({
          role:
            role === "ROOT" || role === "ADMIN" || role === "BLOCKED"
              ? role
              : "MEMBER",
        } as Permission)
      : null;
  const unitId = permission ? (snapshot?.user?.id ?? null) : null;
  const hasAuthSession = permission !== null;

  return {
    status,
    session: snapshot?.session ?? null,
    user: snapshot?.user ?? null,
    authSession: snapshot?.authSession ?? null,
    permission,
    capabilityLevel: hasAuthSession ? "member" : "anonymous",
    hasAuthSession,
    needsVerification: Boolean(snapshot?.authSession && !emailVerified),
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
  const requiresPresence = options?.requirePresence ?? true;

  if (requiresPresence && !hasAuthPresence()) {
    useAuthSessionStore.setState(deriveState(null, "ready"));
    return null;
  }

  store.setPending();

  try {
    const serverState = await authApi.getSessionState();
    const sessionState: AuthSessionSnapshot = {
      session: serverState.session ?? null,
      user: serverState.user ?? null,
      authSession: serverState.authSession,
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
