import type {
  AuthSession,
  AuthUser,
  CapabilityHint,
  GetSessionStateResponse,
  Permission,
} from "@rezics/contract";
import { ApiError } from "@rezics/contract";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";
import { clearAuthPresence, hasAuthPresence } from "./authPresence";

const MAIN_SESSION_REGISTRATION_INCOMPLETE_CODES = new Set([
  "REGISTRATION_INCOMPLETE",
  "MAIN_USER_NOT_READY",
]);

export type AuthSessionHydrationStatus = "idle" | "loading" | "ready" | "error";
export type AuthRegistrationStage =
  | "anonymous"
  | "verify-email"
  | "setup-account"
  | "complete";
export type AuthCapabilityLevel =
  | "anonymous"
  | "pending-verification"
  | "needs-main-setup"
  | "member";

export type AuthSessionSnapshot = {
  session: AuthSession | null;
  user: AuthUser | null;
  authAccountState: GetSessionStateResponse["authAccountState"] | null;
  rezicsUserId?: string | null;
  rezicsPermission?: Permission | null;
  governanceCapabilities?: CapabilityHint[];
};

export type AuthSessionStoreState = {
  status: AuthSessionHydrationStatus;
  auth: {
    session: AuthSession | null;
    user: AuthUser | null;
    role: string | null;
    hasIdentity: boolean;
  };
  rezics: {
    userId: string | null;
    permission: Permission | null;
    governanceCapabilities: CapabilityHint[];
    hasMemberSession: boolean;
    hasProfileSetupSession: boolean;
    mainUserExists: boolean;
  };
  registration: {
    stage: AuthRegistrationStage;
    emailVerified: boolean;
    complete: boolean;
    needsVerification: boolean;
    needsMainSetup: boolean;
  };
  authAccountState: GetSessionStateResponse["authAccountState"] | null;
  capabilityLevel: AuthCapabilityLevel;
  error: string | null;
  setPending: () => void;
  setSessionState: (state: AuthSessionSnapshot | null) => void;
  clearSessionState: () => void;
  reset: () => void;
};

type SessionStateResponse = Partial<GetSessionStateResponse> & {
  session?: AuthSession | null;
  user?: AuthUser | null;
};

function deriveRegistrationStage(input: {
  hasAuthIdentity: boolean;
  emailVerified: boolean;
  mainUserExists: boolean;
  registrationComplete: boolean;
  pendingStep?: string;
}): AuthRegistrationStage {
  if (!input.hasAuthIdentity) return "anonymous";
  if (input.registrationComplete) return "complete";
  if (input.pendingStep === "verify-email" || !input.emailVerified) {
    return "verify-email";
  }
  if (input.pendingStep === "setup-account" || !input.mainUserExists) {
    return "setup-account";
  }
  return "complete";
}

function deriveCapabilityLevel(input: {
  hasMemberSession: boolean;
  registrationStage: AuthRegistrationStage;
}): AuthCapabilityLevel {
  if (input.hasMemberSession) return "member";
  if (input.registrationStage === "verify-email") return "pending-verification";
  if (input.registrationStage === "setup-account") return "needs-main-setup";
  return "anonymous";
}

function deriveAuthSessionState(
  snapshot: AuthSessionSnapshot | null,
  status: AuthSessionHydrationStatus = "ready",
  error: string | null = null,
): Omit<
  AuthSessionStoreState,
  "setPending" | "setSessionState" | "clearSessionState" | "reset"
> {
  const authAccountState = snapshot?.authAccountState ?? null;
  const hasAuthIdentity = Boolean(authAccountState);
  const emailVerified = Boolean(authAccountState?.emailVerified);
  const mainUserExists = Boolean(authAccountState?.mainUserExists);
  const registrationComplete = Boolean(authAccountState?.registrationComplete);
  const permission =
    authAccountState?.canAcquireMemberToken || registrationComplete
      ? (snapshot?.rezicsPermission ?? null)
      : null;
  const hasMemberSession = permission !== null;
  const registrationStage = deriveRegistrationStage({
    hasAuthIdentity,
    emailVerified,
    mainUserExists,
    registrationComplete,
    pendingStep: authAccountState?.pendingRegistration?.step,
  });
  const capabilityLevel = deriveCapabilityLevel({
    hasMemberSession,
    registrationStage,
  });
  const hasProfileSetupSession = Boolean(
    hasAuthIdentity &&
      emailVerified &&
      mainUserExists &&
      !registrationComplete &&
      registrationStage === "setup-account",
  );

  return {
    status,
    auth: {
      session: snapshot?.session ?? null,
      user: snapshot?.user ?? null,
      role: snapshot?.user?.role ?? null,
      hasIdentity: hasAuthIdentity,
    },
    rezics: {
      userId: hasMemberSession ? (snapshot?.rezicsUserId ?? null) : null,
      permission,
      governanceCapabilities: hasMemberSession
        ? (snapshot?.governanceCapabilities ?? [])
        : [],
      hasMemberSession,
      hasProfileSetupSession,
      mainUserExists,
    },
    registration: {
      stage: registrationStage,
      emailVerified,
      complete: registrationComplete,
      needsVerification: hasAuthIdentity && !emailVerified,
      needsMainSetup: Boolean(
        hasAuthIdentity && emailVerified && !registrationComplete,
      ),
    },
    authAccountState,
    capabilityLevel,
    error,
  };
}

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

async function fetchSessionState(): Promise<SessionStateResponse> {
  const response = await apiClient.auth["get-session-state"].get();
  return unwrapEdenResponse(response) as SessionStateResponse;
}

async function fetchGovernanceCapabilities(): Promise<CapabilityHint[]> {
  const response = await apiClient.governance["capability-hints"].me.get();
  return unwrapEdenResponse(response).capabilities;
}

export async function refreshMainSession(): Promise<boolean> {
  const response = await apiClient.auth.session.refresh.post();
  unwrapEdenResponse(response);
  return true;
}

export async function exchangeForSessionToken(): Promise<boolean> {
  try {
    await refreshMainSession();
    return true;
  } catch (error) {
    const code = error instanceof ApiError ? error.code : undefined;
    if (
      !code ||
      !MAIN_SESSION_REGISTRATION_INCOMPLETE_CODES.has(code)
    ) {
      clearAuthPresence();
    }
    return false;
  }
}

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
    const serverState = await fetchSessionState();
    const hasMemberSession = Boolean(
      serverState.authAccountState?.canAcquireMemberToken ||
        serverState.authAccountState?.registrationComplete,
    );
    const governanceCapabilities = hasMemberSession
      ? await fetchGovernanceCapabilities().catch(() => [])
      : [];
    const sessionState: AuthSessionSnapshot = {
      session: serverState.session ?? null,
      user: serverState.user ?? null,
      authAccountState: serverState.authAccountState ?? null,
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
