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
});
