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
};

export type AuthSessionDerivedState = {
  status: AuthSessionHydrationStatus;
  session: AuthSession | null;
  user: AuthUser | null;
  authSession: GetSessionStateResponse["authSession"] | null;
  /**
   * Auth service identity/session state. This can be true before the user has
   * a main Rezics member session.
   */
  hasAuthIdentity: boolean;
  /**
   * Main server member session state. This is true only when main accepts the
   * user as a member and can attach server permission.
   */
  hasMemberSession: boolean;
  /**
   * Main server permission as represented by server-hydrated session state.
   * `null` when the user has no valid main session.
   */
  permission: Permission | null;
  capabilityLevel: AuthCapabilityLevel;
  registrationStage: AuthRegistrationStage;
  needsVerification: boolean;
  needsMainSetup: boolean;
  /**
   * Main server actor userId from server-hydrated session state.
   */
  unitId: string | null;
  mainUserExists: boolean;
  registrationComplete: boolean;
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
  const needsMainSetup = Boolean(
    hasAuthIdentity && emailVerified && !mainUserExists,
  );
  const registrationComplete = Boolean(
    authSession?.registrationComplete || (emailVerified && mainUserExists),
  );
  const role = snapshot?.user?.role?.toUpperCase();
  const permission =
    authSession?.canAcquireMemberToken || registrationComplete
      ? ({
          role:
            role === "ROOT" || role === "ADMIN" || role === "BLOCKED"
              ? role
              : "MEMBER",
        } as Permission)
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

  return {
    status,
    session: snapshot?.session ?? null,
    user: snapshot?.user ?? null,
    authSession,
    hasAuthIdentity,
    hasMemberSession,
    permission,
    capabilityLevel,
    registrationStage,
    needsVerification,
    needsMainSetup,
    unitId: hasMemberSession ? (snapshot?.user?.id ?? null) : null,
    mainUserExists,
    registrationComplete,
    error,
  };
}

export const selectHasAuthIdentity = (state: AuthSessionDerivedState) =>
  state.hasAuthIdentity;

export const selectHasMemberSession = (state: AuthSessionDerivedState) =>
  state.hasMemberSession;

export const selectRegistrationStage = (state: AuthSessionDerivedState) =>
  state.registrationStage;

export const selectIsPendingRegistration = (state: AuthSessionDerivedState) =>
  state.registrationStage === "verify-email" ||
  state.registrationStage === "setup-account";

export const selectShouldRedirectToCompleteRegistration =
  selectIsPendingRegistration;

export const selectCanFetchUserProfile = (state: AuthSessionDerivedState) =>
  state.hasMemberSession;

export const selectIsMemberReady = (state: AuthSessionDerivedState) =>
  state.hasMemberSession && state.registrationComplete;
