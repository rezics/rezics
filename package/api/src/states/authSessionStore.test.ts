import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { GetSessionStateResponse } from "@rezics/contract";

let presence = false;
const getSessionStateMock = mock();

mock.module("@rezics/api/react-query/authPresence", () => ({
  hasAuthPresence: () => presence,
  clearAuthPresence: () => {
    presence = false;
  },
}));

mock.module("@rezics/api/auth/auth.api", () => ({
  authApi: {
    getSessionState: getSessionStateMock,
  },
}));

const readySession: GetSessionStateResponse = {
  session: {
    id: "session-1",
    token: "session-token",
    expiresAt: "2026-03-10T00:00:00.000Z",
    userId: "user-1",
  },
  user: {
    id: "user-1",
    name: "Reader",
    role: "user",
    email: "reader@example.com",
    emailVerified: true,
    createdAt: "2026-03-10T00:00:00.000Z",
    updatedAt: "2026-03-10T00:00:00.000Z",
  },
  authSession: {
    email: "reader@example.com",
    emailVerified: true,
    mainUserExists: true,
    registrationComplete: true,
    canAcquireMemberToken: true,
    readinessStatus: "member-ready" as const,
    pendingRegistration: {
      active: false,
      email: "reader@example.com",
      emailVerified: true,
      requiresEmailVerification: false,
      requiresMainAccountSetup: false,
    },
    hasPassword: true,
    canSetPassword: false,
    providerIds: ["google"],
    primaryProviderId: "google",
    trustedProviderId: "google",
  },
};

const incompleteSession = {
  ...readySession,
  authSession: {
    ...readySession.authSession,
    emailVerified: false,
    mainUserExists: false,
    registrationComplete: false,
    canAcquireMemberToken: false,
    readinessStatus: "pending-verification" as const,
    pendingRegistration: {
      active: true,
      step: "verify-email" as const,
      email: "reader@example.com",
      emailVerified: false,
      requiresEmailVerification: true,
      requiresMainAccountSetup: false,
    },
    trustedProviderId: undefined,
  },
};

const setupRequiredSession = {
  ...readySession,
  authSession: {
    ...readySession.authSession,
    mainUserExists: false,
    registrationComplete: false,
    canAcquireMemberToken: false,
    readinessStatus: "needs-main-setup" as const,
    pendingRegistration: {
      active: true,
      step: "setup-account" as const,
      email: "reader@example.com",
      emailVerified: true,
      requiresEmailVerification: false,
      requiresMainAccountSetup: true,
    },
  },
};

describe("authSessionStore", () => {
  beforeEach(async () => {
    presence = false;
    getSessionStateMock.mockReset();
    const { clearAuthSessionState } = await import("./authSessionStore");
    clearAuthSessionState();
  });

  test("hydrates ready state on reload when session is complete", async () => {
    presence = true;
    getSessionStateMock.mockResolvedValueOnce(readySession);

    const { hydrateAuthSessionState, useAuthSessionStore } = await import(
      "./authSessionStore"
    );

    await hydrateAuthSessionState();

    expect(useAuthSessionStore.getState()).toMatchObject({
      status: "ready",
      capabilityLevel: "member",
      registrationStage: "complete",
      hasAuthIdentity: true,
      hasMemberSession: true,
      needsVerification: false,
      registrationComplete: true,
      mainUserExists: true,
    });
  });

  test("derives pending verification from authSession state", async () => {
    const { useAuthSessionStore } = await import("./authSessionStore");

    useAuthSessionStore.getState().setSessionState(incompleteSession);

    expect(useAuthSessionStore.getState()).toMatchObject({
      capabilityLevel: "pending-verification",
      registrationStage: "verify-email",
      hasAuthIdentity: true,
      hasMemberSession: false,
      registrationComplete: false,
      mainUserExists: false,
      needsVerification: true,
    });
  });

  test("derives main setup required from verified auth-only state", async () => {
    const { useAuthSessionStore } = await import("./authSessionStore");

    useAuthSessionStore.getState().setSessionState(setupRequiredSession);

    expect(useAuthSessionStore.getState()).toMatchObject({
      capabilityLevel: "needs-main-setup",
      registrationStage: "setup-account",
      hasAuthIdentity: true,
      hasMemberSession: false,
      registrationComplete: false,
      mainUserExists: false,
      needsVerification: false,
      needsMainSetup: true,
    });
  });

  test("hydrates authenticated but incomplete registration as not complete", async () => {
    presence = true;
    getSessionStateMock.mockResolvedValueOnce(incompleteSession);

    const { hydrateAuthSessionState, useAuthSessionStore } = await import(
      "./authSessionStore"
    );

    await hydrateAuthSessionState();

    expect(useAuthSessionStore.getState()).toMatchObject({
      status: "ready",
      capabilityLevel: "pending-verification",
      registrationStage: "verify-email",
      hasAuthIdentity: true,
      hasMemberSession: false,
      needsVerification: true,
      registrationComplete: false,
    });
  });

  test("skips passive hydration when no auth presence exists", async () => {
    const { hydrateAuthSessionState, useAuthSessionStore } = await import(
      "./authSessionStore"
    );

    const result = await hydrateAuthSessionState();

    expect(result).toBeNull();
    expect(getSessionStateMock).not.toHaveBeenCalled();
    expect(useAuthSessionStore.getState()).toMatchObject({
      status: "ready",
      capabilityLevel: "anonymous",
      registrationStage: "anonymous",
      hasAuthIdentity: false,
      hasMemberSession: false,
    });
  });

  test("allows explicit post-auth hydration before presence is readable", async () => {
    presence = false;
    getSessionStateMock.mockResolvedValueOnce(setupRequiredSession);

    const { hydrateAuthSessionState, useAuthSessionStore } = await import(
      "./authSessionStore"
    );

    await hydrateAuthSessionState({ requirePresence: false });

    expect(getSessionStateMock).toHaveBeenCalledTimes(1);
    expect(useAuthSessionStore.getState()).toMatchObject({
      status: "ready",
      capabilityLevel: "needs-main-setup",
      registrationStage: "setup-account",
      hasAuthIdentity: true,
      hasMemberSession: false,
      needsMainSetup: true,
      registrationComplete: false,
    });
  });

  test("fails closed and clears presence on stale passive auth presence", async () => {
    presence = true;
    getSessionStateMock.mockRejectedValueOnce(new Error("Unauthorized"));

    const { hydrateAuthSessionState, useAuthSessionStore } = await import(
      "./authSessionStore"
    );

    await hydrateAuthSessionState();

    expect(presence).toBe(false);
    expect(useAuthSessionStore.getState()).toMatchObject({
      status: "error",
      capabilityLevel: "anonymous",
      registrationStage: "anonymous",
      hasAuthIdentity: false,
      hasMemberSession: false,
    });
  });

  test("exports selectors that separate auth identity from member session", async () => {
    const { useAuthSessionStore } = await import("./authSessionStore");
    const {
      selectCanFetchUserProfile,
      selectHasAuthIdentity,
      selectHasMemberSession,
      selectShouldRedirectToCompleteRegistration,
    } = await import("./authSessionModel");

    useAuthSessionStore.getState().setSessionState(setupRequiredSession);
    const state = useAuthSessionStore.getState();

    expect(selectHasAuthIdentity(state)).toBe(true);
    expect(selectHasMemberSession(state)).toBe(false);
    expect(selectCanFetchUserProfile(state)).toBe(false);
    expect(selectShouldRedirectToCompleteRegistration(state)).toBe(true);
  });
});
