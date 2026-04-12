import { authApi } from "@rezics/api/auth/auth.api";
import {
  clearAuthPresence,
  hasAuthPresence,
} from "@rezics/api/react-query/authPresence";
import { getToken, parseJwt } from "@rezics/api/react-query/jwt";
import type {
  AuthSession,
  AuthUser,
  GetSessionStateResponse,
} from "@rezics/contract";
import { NormalizedTokenName } from "@rezics/contract";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type AuthCapabilityLevel = "anonymous" | "member";
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
  hasAuthSession: boolean;
  capabilityLevel: AuthCapabilityLevel;
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

function deriveState(
  snapshot: AuthSessionSnapshot | null,
  status: AuthSessionHydrationStatus = "ready",
  error: string | null = null,
) {
  const hasAuthSession = Boolean(snapshot?.session?.id && snapshot?.user?.id);
  const needsVerification = deriveNeedsVerification();
  const needsOnboarding = Boolean(snapshot?.authSession?.needsOnboarding);

  const capabilityLevel: AuthCapabilityLevel = hasAuthSession
    ? "member"
    : "anonymous";

  return {
    status,
    session: snapshot?.session ?? null,
    user: snapshot?.user ?? null,
    authSession: snapshot?.authSession ?? null,
    hasAuthSession,
    capabilityLevel,
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
    const sessionState = await authApi.getSessionState();
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
