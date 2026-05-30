import type {
  AuthSession,
  AuthUser,
  CapabilityHint,
  CapabilityScope,
  GetSessionStateResponse,
  Permission,
} from "@rezics/contract";

export type AuthSessionHydrationStatus = "idle" | "loading" | "ready" | "error";
export type AuthCapabilityLevel =
  | "anonymous"
  | "pending-verification"
  | "needs-main-setup"
  | "member";
export type AuthRegistrationStage =
  | "anonymous"
  | "verify-email"
  | "setup-account"
  | "complete";

export type AuthSessionSnapshot = {
  session: GetSessionStateResponse["session"] | null;
  user: GetSessionStateResponse["user"] | null;
  authAccountState: GetSessionStateResponse["authAccountState"];
  rezicsUserId?: GetSessionStateResponse["rezicsUserId"] | null;
  rezicsPermission?: GetSessionStateResponse["rezicsPermission"] | null;
  governanceCapabilities?: CapabilityHint[];
};

export type AuthSessionAuthState = {
  session: AuthSession | null;
  user: AuthUser | null;
  role: string | null;
  hasIdentity: boolean;
};

export type RezicsSessionState = {
  userId: string | null;
  permission: Permission | null;
  governanceCapabilities: CapabilityHint[];
  hasMemberSession: boolean;
  hasProfileSetupSession: boolean;
  mainUserExists: boolean;
};

export type AuthRegistrationState = {
  stage: AuthRegistrationStage;
  emailVerified: boolean;
  complete: boolean;
  needsVerification: boolean;
  needsMainSetup: boolean;
};

export type AuthSessionDerivedState = {
  status: AuthSessionHydrationStatus;
  auth: AuthSessionAuthState;
  rezics: RezicsSessionState;
  registration: AuthRegistrationState;
  authAccountState: GetSessionStateResponse["authAccountState"] | null;
  // TODO(openspec-retired): capabilityLevel was slated for removal in favor of role/unitId; it remains in use. Revisit.
  capabilityLevel: AuthCapabilityLevel;
  error: string | null;
};

function deriveRegistrationStage(input: {
  hasAuthIdentity: boolean;
  emailVerified: boolean;
  mainUserExists: boolean;
  registrationComplete: boolean;
  pendingStep?: GetSessionStateResponse["authAccountState"]["pendingRegistration"]["step"];
}): AuthRegistrationStage {
  if (!input.hasAuthIdentity) {
    return "anonymous";
  }

  if (input.registrationComplete) {
    return "complete";
  }

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
  if (input.hasMemberSession) {
    return "member";
  }

  if (input.registrationStage === "verify-email") {
    return "pending-verification";
  }

  if (input.registrationStage === "setup-account") {
    return "needs-main-setup";
  }

  return "anonymous";
}

export function deriveAuthSessionState(
  snapshot: AuthSessionSnapshot | null,
  status: AuthSessionHydrationStatus = "ready",
  error: string | null = null,
): AuthSessionDerivedState {
  const authAccountState = snapshot?.authAccountState ?? null;
  const hasAuthIdentity = Boolean(authAccountState);
  const emailVerified = Boolean(authAccountState?.emailVerified);
  const mainUserExists = Boolean(authAccountState?.mainUserExists);
  const needsVerification = hasAuthIdentity && !emailVerified;
  const registrationComplete = Boolean(authAccountState?.registrationComplete);
  const needsMainSetup = Boolean(
    hasAuthIdentity && emailVerified && !registrationComplete,
  );
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
      // UI visibility hints only. Server policy remains the source of truth.
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
      needsVerification,
      needsMainSetup,
    },
    authAccountState,
    capabilityLevel,
    error,
  };
}

export const selectHasAuthIdentity = (state: AuthSessionDerivedState) =>
  state.auth.hasIdentity;

export const selectHasMemberSession = (state: AuthSessionDerivedState) =>
  state.rezics.hasMemberSession;

export const selectRegistrationStage = (state: AuthSessionDerivedState) =>
  state.registration.stage;

export const selectIsPendingRegistration = (state: AuthSessionDerivedState) =>
  state.registration.stage === "verify-email" ||
  state.registration.stage === "setup-account";

export const selectShouldRedirectToCompleteRegistration =
  selectIsPendingRegistration;

export const selectCanFetchUserProfile = (state: AuthSessionDerivedState) =>
  state.rezics.hasMemberSession;

export const selectIsMemberReady = (state: AuthSessionDerivedState) =>
  state.rezics.hasMemberSession && state.registration.complete;

export const selectGovernanceCapabilityHints = (
  state: AuthSessionDerivedState,
) => state.rezics.governanceCapabilities;

export function hasGovernanceCapabilityHint(
  state: AuthSessionDerivedState,
  capability: CapabilityHint["capability"],
  scope?: CapabilityScope,
) {
  return state.rezics.governanceCapabilities.some((hint) => {
    if (hint.capability !== capability) return false;
    if (!scope) return true;
    if (hint.scope.kind !== scope.kind) return false;
    if (scope.kind === "realm") {
      return hint.scope.realmUnitId === scope.realmUnitId;
    }
    return true;
  });
}
