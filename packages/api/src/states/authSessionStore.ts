import { authApi } from "@rezics/api/auth/auth.api";
import { governanceApi } from "@rezics/api/governance/governance.api";
import {
  clearAuthPresence,
  hasAuthPresence,
} from "@rezics/api/react-query/authPresence";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  type AuthSessionDerivedState,
  type AuthSessionSnapshot,
  deriveAuthSessionState,
} from "./authSessionModel";

export type AuthSessionStoreState = AuthSessionDerivedState & {
  setPending: () => void;
  setSessionState: (state: AuthSessionSnapshot | null) => void;
  clearSessionState: () => void;
  reset: () => void;
};

const initialState = deriveAuthSessionState(null, "idle");

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
      setSessionState: (state) => set(deriveAuthSessionState(state, "ready")),
      clearSessionState: () => set(deriveAuthSessionState(null, "ready")),
      reset: () => set(deriveAuthSessionState(null, "idle")),
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
    useAuthSessionStore.setState(deriveAuthSessionState(null, "ready"));
    return null;
  }

  store.setPending();

  try {
    const serverState = await authApi.getSessionState();
    const hasMemberSession = Boolean(
      serverState.authAccountState.canAcquireMemberToken ||
        serverState.authAccountState.registrationComplete,
    );
    const governanceCapabilities = hasMemberSession
      ? await governanceApi
          .capabilityHints()
          .then((response) => response.capabilities)
          .catch(() => [])
      : [];
    const sessionState: AuthSessionSnapshot = {
      session: serverState.session ?? null,
      user: serverState.user ?? null,
      authAccountState: serverState.authAccountState,
      rezicsUserId: serverState.rezicsUserId ?? null,
      rezicsPermission: serverState.rezicsPermission ?? null,
      governanceCapabilities,
    };

    useAuthSessionStore.getState().setSessionState(sessionState);
    return sessionState;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown auth session error";
    clearAuthPresence();
    useAuthSessionStore.setState(
      deriveAuthSessionState(null, "error", message),
    );
    return null;
  }
}

export function clearAuthSessionState() {
  useAuthSessionStore.getState().clearSessionState();
}
