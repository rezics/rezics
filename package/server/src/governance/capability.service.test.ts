import { beforeEach, describe, expect, mock, test } from "bun:test";
import type {
  GovernanceCapabilityRepository,
  GovernanceCapabilityService,
} from "./capability.service";

const listStaffGrants = mock(
  async () =>
    [
      {
        capability: "audit.read",
        scopeKind: "global",
        realmUnitId: null,
        state: "ACTIVE",
        expiresAt: null,
      },
      {
        capability: "account.ban",
        scopeKind: "global",
        realmUnitId: null,
        state: "EXPIRED",
        expiresAt: null,
      },
    ] as any[],
);

const listRealmGrantsForUser = mock(
  async () =>
    [
      {
        capability: "queue.realm.decide",
        realmUnitId: "realm-1",
        state: "ACTIVE",
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      },
      {
        capability: "tag.curate",
        realmUnitId: "realm-1",
        state: "ACTIVE",
        expiresAt: new Date("2000-01-01T00:00:00.000Z"),
      },
    ] as any[],
);

const getRealmMember = mock(async () => null as any);

beforeEach(() => {
  listStaffGrants.mockClear();
  listRealmGrantsForUser.mockClear();
  getRealmMember.mockClear();
  getRealmMember.mockResolvedValue(null as any);
});

function createRepository(): GovernanceCapabilityRepository {
  return {
    listStaffGrants,
    listRealmGrantsForUser,
    getRealmMember,
    listRealmGrants: mock(async () => []),
    createRealmGrant: mock(async () => ({}) as any),
    listActiveRealmGrants: mock(async () => []),
    revokeRealmGrant: mock(async () => ({}) as any),
  };
}

async function createService(): Promise<GovernanceCapabilityService> {
  const { GovernanceCapabilityService } = await import("./capability.service");
  return new GovernanceCapabilityService(createRepository());
}

describe("GovernanceCapabilityService", () => {
  test("resolves active staff and realm grants into one scoped hint shape", async () => {
    const hints = await (await createService()).resolveForUser("user-1");

    expect(hints).toEqual([
      {
        capability: "audit.read",
        scope: { kind: "global" },
        expiresAt: null,
      },
      {
        capability: "queue.realm.decide",
        scope: { kind: "realm", realmUnitId: "realm-1" },
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
    ]);
    expect(listStaffGrants).toHaveBeenCalledWith("user-1");
    expect(listRealmGrantsForUser).toHaveBeenCalledWith("user-1");
  });

  test("exposes root staff capability hints without requiring persisted grants", async () => {
    const hints = await (await createService()).resolveHintsForIdentity({
      userId: "root-1",
      permission: { role: "ROOT" },
    });

    expect(hints).toContainEqual({
      capability: "audit.read",
      scope: { kind: "global" },
    });
    expect(hints).toContainEqual({
      capability: "account.ban",
      scope: { kind: "global" },
    });
    expect(hints).toContainEqual({
      capability: "account.unblock",
      scope: { kind: "global" },
    });
    expect(hints).toContainEqual({
      capability: "comment.moderate",
      scope: { kind: "global" },
    });
    expect(listStaffGrants).not.toHaveBeenCalled();
    expect(listRealmGrantsForUser).not.toHaveBeenCalled();
  });

  test("realm moderator roles imply moderation and tag curation capabilities", async () => {
    getRealmMember.mockResolvedValueOnce({
      realmUnitId: "realm-1",
      userId: "mod-1",
      roleKey: "moderator",
      state: "ACTIVE",
    } as any);

    const membership = await (await createService()).realmMembershipForPolicy(
      "realm-1",
      "mod-1",
    );

    expect(membership?.capabilities).toContainEqual({
      capability: "comment.moderate",
      scope: { kind: "realm", realmUnitId: "realm-1" },
    });
    expect(membership?.capabilities).toContainEqual({
      capability: "realm.member.moderate",
      scope: { kind: "realm", realmUnitId: "realm-1" },
    });
    expect(membership?.capabilities).toContainEqual({
      capability: "tag.curate",
      scope: { kind: "realm", realmUnitId: "realm-1" },
    });
  });
});
