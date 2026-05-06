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
    identitySet: true,
    registrationComplete: true,
    canAcquireMemberToken: true,
    readinessStatus: "ready" as const,
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
    identitySet: false,
    registrationComplete: false,
    canAcquireMemberToken: false,
    readinessStatus: "needs-registration" as const,
    trustedProviderId: undefined,
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
      hasAuthSession: true,
      needsVerification: false,
      registrationComplete: true,
      identitySet: true,
    });
  });

  test("derives registrationComplete from authSession state", async () => {
    const { useAuthSessionStore } = await import("./authSessionStore");

    useAuthSessionStore.getState().setSessionState(incompleteSession);

    expect(useAuthSessionStore.getState()).toMatchObject({
      registrationComplete: false,
      identitySet: false,
      needsVerification: true,
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
      capabilityLevel: "anonymous",
      hasAuthSession: false,
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
      hasAuthSession: false,
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
      hasAuthSession: false,
    });
  });
});
