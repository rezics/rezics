import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

installPrismaClientMock();

beforeEach(() => {
  prismaMock.staffGrant = {
    findMany: mock(async () => [
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
    ]),
  };
  prismaMock.realmCapabilityGrant = {
    findMany: mock(async () => [
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
    ]),
  };
});

afterEach(() => {
  delete prismaMock.staffGrant;
  delete prismaMock.realmCapabilityGrant;
  delete prismaMock.realmMember;
});

describe("GovernanceCapabilityService", () => {
  test("resolves active staff and realm grants into one scoped hint shape", async () => {
    const { governanceCapabilityService } = await import(
      "./capability.service"
    );
    const hints = await governanceCapabilityService.resolveForUser("user-1");

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
    expect(prismaMock.staffGrant.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(prismaMock.realmCapabilityGrant.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });

  test("exposes root staff capability hints without requiring persisted grants", async () => {
    const { governanceCapabilityService } = await import(
      "./capability.service"
    );

    const hints = await governanceCapabilityService.resolveHintsForIdentity({
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
    expect(prismaMock.staffGrant.findMany).not.toHaveBeenCalled();
    expect(prismaMock.realmCapabilityGrant.findMany).not.toHaveBeenCalled();
  });

  test("realm moderator roles imply comment and member moderation capabilities", async () => {
    prismaMock.realmMember = {
      findUnique: mock(async () => ({
        realmUnitId: "realm-1",
        userId: "mod-1",
        roleKey: "moderator",
        state: "ACTIVE",
      })),
    };

    const { governanceCapabilityService } = await import(
      "./capability.service"
    );
    const membership =
      await governanceCapabilityService.realmMembershipForPolicy(
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
  });
});
