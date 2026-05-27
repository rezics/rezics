import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const authorityMock = mock(async (_caller: any, unit: any) => {
  return unit.userId === "caller-1";
});
const notifyMock = mock(async (_body: any) => ({ success: true }));
const createMembershipMock = mock(async (input: any) => input);

const unitFindUniqueMock = mock(async ({ where }: any) => {
  if (where.id === "release-1") {
    return { id: "release-1", type: "BOOK", userId: "caller-1" };
  }
  if (where.id === "other-release") {
    return { id: "other-release", type: "BOOK", userId: "other-user" };
  }
  if (where.id === "post-release") {
    return { id: "post-release", type: "POST", userId: "caller-1" };
  }
  if (where.id === "work-1") {
    return { id: "work-1", type: "BOOK", userId: "caller-1" };
  }
  if (where.id === "other-work") {
    return { id: "other-work", type: "BOOK", userId: "other-user" };
  }
  if (where.id === "post-work") {
    return { id: "post-work", type: "POST", userId: "other-user" };
  }
  if (where.id === "wiki-work") {
    return { id: "wiki-work", type: "BOOK", userId: "wiki-owner" };
  }
  return null;
});
const claimFindFirstMock = mock(async () => null);
const claimCreateMock = mock(async () => ({ id: "claim-1" }));
const claimUpdateManyMock = mock(async () => ({ count: 1 }));
const unitWorkDeleteManyMock = mock(async () => ({ count: 1 }));
const transactionMock = mock(async (arg: any) => {
  if (Array.isArray(arg)) return Promise.all(arg);
  return arg(prismaMock);
});

installPrismaClientMock();
Object.assign(prismaMock, {
  $transaction: transactionMock,
  unit: { findUnique: unitFindUniqueMock },
  unitWork: { deleteMany: unitWorkDeleteManyMock },
  workLinkClaim: {
    findFirst: claimFindFirstMock,
    create: claimCreateMock,
    updateMany: claimUpdateManyMock,
  },
});

mock.module("./authority", () => ({
  hasAuthorityOver: authorityMock,
}));

mock.module("@/unit-work", () => ({
  unitWorkService: { create: createMembershipMock },
}));

mock.module("@/notify-boundary/notify-boundary.client", () => ({
  notifySystemAndEmail: notifyMock,
}));

const { applyUnitWorkMembership } = await import(
  "./unit-work-membership.service"
);

describe("UnitWork membership service", () => {
  const caller = { userId: "caller-1" } as any;

  beforeEach(() => {
    authorityMock.mockClear();
    notifyMock.mockClear();
    createMembershipMock.mockClear();
    unitFindUniqueMock.mockClear();
    claimFindFirstMock.mockClear();
    claimFindFirstMock.mockImplementation(async () => null);
    claimCreateMock.mockClear();
    claimUpdateManyMock.mockClear();
    unitWorkDeleteManyMock.mockClear();
    transactionMock.mockClear();
  });

  test("requires release-side authority", async () => {
    await expect(
      applyUnitWorkMembership(caller, "other-release", "work-1"),
    ).rejects.toThrow("Caller lacks authority over the release unit");
    expect(createMembershipMock).not.toHaveBeenCalled();
  });

  test("creates UnitWork immediately when caller has work-side authority", async () => {
    const result = await applyUnitWorkMembership(caller, "release-1", "work-1");

    expect(result).toEqual({ status: "LINKED" });
    expect(createMembershipMock).toHaveBeenCalledWith(
      expect.objectContaining({
        unitId: "release-1",
        workUnitId: "work-1",
        role: "RELEASE",
      }),
    );
  });

  test("uses the wiki short-circuit for catalog work membership", async () => {
    const result = await applyUnitWorkMembership(
      caller,
      "release-1",
      "wiki-work",
    );

    expect(result).toEqual({ status: "LINKED", autoApproved: true });
    expect(createMembershipMock).toHaveBeenCalledWith(
      expect.objectContaining({ workUnitId: "wiki-work" }),
    );
  });

  test("creates a pending membership claim without work-side authority", async () => {
    const result = await applyUnitWorkMembership(
      caller,
      "post-release",
      "post-work",
    );

    expect(result).toEqual({ status: "PENDING", claimId: "claim-1" });
    expect(claimCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          releaseUnitId: "post-release",
          workUnitId: "post-work",
          claimerUserId: "caller-1",
          status: "PENDING",
        }),
      }),
    );
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "other-user",
        kind: "WORK_MEMBERSHIP_CLAIM_PENDING",
      }),
    );
  });

  test("clears release membership and withdraws pending claims", async () => {
    const result = await applyUnitWorkMembership(caller, "release-1", null);

    expect(result).toEqual({ status: "UNLINKED" });
    expect(unitWorkDeleteManyMock).toHaveBeenCalledWith({
      where: { unitId: "release-1", role: "RELEASE" },
    });
    expect(claimUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { releaseUnitId: "release-1", status: "PENDING" },
        data: expect.objectContaining({ status: "WITHDRAWN" }),
      }),
    );
  });
});
