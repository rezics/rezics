import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

installPrismaClientMock();

const accountEnforcementFindMany = mock(async (): Promise<any[]> => []);

Object.assign(prismaMock, {
  accountEnforcement: {
    findMany: accountEnforcementFindMany,
  },
});

describe("GovernanceEnforcementService", () => {
  beforeEach(() => {
    accountEnforcementFindMany.mockClear();
    accountEnforcementFindMany.mockResolvedValue([]);
  });

  test("projects BLOCKED from an active ban enforcement", async () => {
    accountEnforcementFindMany.mockResolvedValueOnce([
      {
        kind: "BAN",
        expiresAt: null,
        createdAt: new Date("2026-05-28T00:00:00.000Z"),
      },
    ]);

    const { governanceEnforcementService } = await import(
      "./enforcement.service"
    );
    await expect(
      governanceEnforcementService.projectedPermissionForUser("user-1", {
        role: ["MEMBER"],
      }),
    ).resolves.toEqual({ role: "BLOCKED" });
  });

  test("downgrades stale stored BLOCKED when no active ban exists", async () => {
    const { governanceEnforcementService } = await import(
      "./enforcement.service"
    );
    await expect(
      governanceEnforcementService.projectedPermissionForUser("user-1", {
        role: ["BLOCKED"],
      }),
    ).resolves.toEqual({ role: "MEMBER" });
  });

  test("preserves non-blocked stored roles", async () => {
    const { governanceEnforcementService } = await import(
      "./enforcement.service"
    );
    await expect(
      governanceEnforcementService.projectedPermissionForUser("user-1", {
        role: ["ADMIN"],
      }),
    ).resolves.toEqual({ role: "ADMIN" });
  });
});
