import type {
  AuthSession,
  AuthUser,
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
  authSession: GetSessionStateResponse["authSession"];
  rezicsUserId?: GetSessionStateResponse["rezicsUserId"] | null;
  rezicsPermission?: GetSessionStateResponse["rezicsPermission"] | null;
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
  authSession: GetSessionStateResponse["authSession"] | null;
  capabilityLevel: AuthCapabilityLevel;
  error: string | null;
};

function deriveRegistrationStage(input: {
  hasAuthIdentity: boolean;
  emailVerified: boolean;
  mainUserExists: boolean;
  registrationComplete: boolean;
  pendingStep?: GetSessionStateResponse["authSession"]["pendingRegistration"]["step"];
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
  const authSession = snapshot?.authSession ?? null;
  const hasAuthIdentity = Boolean(authSession);
  const emailVerified = Boolean(authSession?.emailVerified);
  const mainUserExists = Boolean(authSession?.mainUserExists);
  const needsVerification = hasAuthIdentity && !emailVerified;
  const registrationComplete = Boolean(authSession?.registrationComplete);
  const needsMainSetup = Boolean(
    hasAuthIdentity && emailVerified && !registrationComplete,
  );
  const permission =
    authSession?.canAcquireMemberToken || registrationComplete
      ? (snapshot?.rezicsPermission ?? null)
      : null;
  const hasMemberSession = permission !== null;
  const registrationStage = deriveRegistrationStage({
    hasAuthIdentity,
    emailVerified,
    mainUserExists,
    registrationComplete,
    pendingStep: authSession?.pendingRegistration?.step,
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
    authSession,
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
