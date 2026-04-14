import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { GetSessionStateResponse } from "@rezics/contract";
import { NormalizedTokenName } from "@rezics/contract";

const tokenState: Partial<Record<NormalizedTokenName, string | null>> = {};
let presence = false;
const getSessionStateMock = mock();

mock.module("@rezics/api/react-query/jwt", () => ({
  getToken: (tokenName?: NormalizedTokenName) =>
    tokenName ? (tokenState[tokenName] ?? null) : null,
}));

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
    needsEmailVerification: false,
    needsOnboarding: false,
    canAcquireMemberToken: true,
    readinessStatus: "ready" as const,
    hasPassword: true,
    canSetPassword: false,
    providerIds: ["google"],
    primaryProviderId: "google",
    trustedProviderId: "google",
  },
};

const guestSession = {
  ...readySession,
  authSession: {
    ...readySession.authSession,
    emailVerified: false,
    needsEmailVerification: true,
    canAcquireMemberToken: false,
    readinessStatus: "needs-verification" as const,
    trustedProviderId: undefined,
  },
};

describe("authSessionStore", () => {
  beforeEach(async () => {
    tokenState[NormalizedTokenName.REZICS_SESSION] = null;
    presence = false;
    getSessionStateMock.mockReset();
    const { clearAuthSessionState, useAuthSessionStore } = await import(
      "./authSessionStore"
    );
    clearAuthSessionState();
    useAuthSessionStore.getState().syncBusinessToken(null);
  });

  test("hydrates member-ready state on reload when a business token already exists", async () => {
    tokenState[NormalizedTokenName.REZICS_SESSION] = "member-token";
    presence = true;
    getSessionStateMock.mockResolvedValueOnce(readySession);

    const { hydrateAuthSessionState, useAuthSessionStore } = await import(
      "./authSessionStore"
    );

    await hydrateAuthSessionState();

    expect(useAuthSessionStore.getState()).toMatchObject({
      status: "ready",
      hasAuthSession: true,
      hasBusinessToken: true,
      capabilityLevel: "member",
      needsVerification: false,
      needsOnboarding: false,
    });
  });

  test("derives needsVerification from authSession state", async () => {
    const { useAuthSessionStore } = await import("./authSessionStore");

    useAuthSessionStore.getState().setSessionState(guestSession);

    expect(useAuthSessionStore.getState()).toMatchObject({
      hasBusinessToken: false,
      needsVerification: true,
      capabilityLevel: "guest",
    });
  });

  test("hydrates authenticated but unverified sessions as guest-capable", async () => {
    presence = true;
    getSessionStateMock.mockResolvedValueOnce(guestSession);

    const { hydrateAuthSessionState, useAuthSessionStore } = await import(
      "./authSessionStore"
    );

    await hydrateAuthSessionState();

    expect(useAuthSessionStore.getState()).toMatchObject({
      status: "ready",
      hasAuthSession: true,
      hasBusinessToken: false,
      capabilityLevel: "guest",
      needsVerification: true,
    });
  });

  test("skips passive hydration when no token and no auth presence exist", async () => {
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
      hasAuthSession: false,
      capabilityLevel: "anonymous",
    });
  });
});
