import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const authorityMock = mock(async (_caller: any, unit: any) => {
  return unit.userId === "work-owner";
});
const notifyMock = mock(async (_body: any) => ({ success: true }));

const baseClaim = {
  id: "claim-1",
  releaseUnitId: "release-1",
  workUnitId: "work-1",
  claimerUserId: "claimer-1",
  status: "PENDING",
  rejectReason: null,
  createdAt: new Date("2026-05-27T00:00:00.000Z"),
  resolvedAt: null,
  resolvedBy: null,
};

const claimFindUniqueMock = mock(async () => ({
  ...baseClaim,
  workUnit: { userId: "work-owner" },
  releaseUnit: { userId: "claimer-1" },
}));
const claimUpdateMock = mock(async ({ data }: any) => ({
  ...baseClaim,
  ...data,
}));
const unitWorkUpsertMock = mock(async ({ create }: any) => create);
const transactionMock = mock(async (fn: (tx: any) => unknown) =>
  fn(prismaMock),
);

installPrismaClientMock();
Object.assign(prismaMock, {
  $transaction: transactionMock,
  workLinkClaim: {
    findUnique: claimFindUniqueMock,
    update: claimUpdateMock,
  },
  unitWork: {
    upsert: unitWorkUpsertMock,
  },
});

mock.module("./authority", () => ({
  hasAuthorityOver: authorityMock,
}));

mock.module("@/notify-boundary/notify-boundary.client", () => ({
  notifySystemAndEmail: notifyMock,
}));

const { approve, reject, withdraw } = await import(
  "./work-membership-claim.service"
);

describe("Work membership claim service", () => {
  beforeEach(() => {
    authorityMock.mockClear();
    notifyMock.mockClear();
    claimFindUniqueMock.mockClear();
    claimFindUniqueMock.mockImplementation(async () => ({
      ...baseClaim,
      workUnit: { userId: "work-owner" },
      releaseUnit: { userId: "claimer-1" },
    }));
    claimUpdateMock.mockClear();
    unitWorkUpsertMock.mockClear();
    transactionMock.mockClear();
  });

  test("approval creates UnitWork release membership", async () => {
    const dto = await approve({ userId: "work-owner" } as any, "claim-1");

    expect(dto.status).toBe("APPROVED");
    expect(unitWorkUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          unitId: "release-1",
          workUnitId: "work-1",
          role: "RELEASE",
        }),
      }),
    );
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "claimer-1",
        kind: "WORK_MEMBERSHIP_CLAIM_APPROVED",
      }),
    );
  });

  test("rejection records reason without creating membership", async () => {
    const dto = await reject(
      { userId: "work-owner" } as any,
      "claim-1",
      "not the same work",
    );

    expect(dto.status).toBe("REJECTED");
    expect(dto.rejectReason).toBe("not the same work");
    expect(unitWorkUpsertMock).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "claimer-1",
        kind: "WORK_MEMBERSHIP_CLAIM_REJECTED",
      }),
    );
  });

  test("withdrawal is limited to the original claimer", async () => {
    await expect(
      withdraw({ userId: "someone-else" } as any, "claim-1"),
    ).rejects.toThrow("Only the original claimer may withdraw a claim");

    const dto = await withdraw({ userId: "claimer-1" } as any, "claim-1");
    expect(dto.status).toBe("WITHDRAWN");
  });
});
