import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const sendMainEmailVerificationContractEmail = mock(async () => ({ ok: true }));
const userFindUniqueOrThrow = mock(async () => ({
  email: "old@example.com",
}));
const userUpdate = mock(async () => undefined);
const contractFindUnique = mock(async () => null);
const contractFindFirst = mock(async () => null);
const contractUpdate = mock(async () => ({
  email: "new@example.com",
  status: "VERIFIED",
  expiresAt: new Date(Date.now() + 60_000),
  lastSentAt: new Date(),
}));
const contractUpsert = mock(async (args: any) => ({
  email: args.create.email,
  status: "PENDING",
  expiresAt: args.create.expiresAt,
  lastSentAt: args.create.lastSentAt,
}));
const transaction = mock(async (callback: any) =>
  callback({
    user: { update: userUpdate },
    emailVerificationContract: { update: contractUpdate },
  }),
);

installPrismaClientMock();
Object.assign(prismaMock, {
  user: {
    findUniqueOrThrow: userFindUniqueOrThrow,
    update: userUpdate,
  },
  emailVerificationContract: {
    findFirst: contractFindFirst,
    findUnique: contractFindUnique,
    update: contractUpdate,
    upsert: contractUpsert,
  },
  $transaction: transaction,
});

mock.module("./main-email-verification.service", () => ({
  USER_EMAIL_CONTRACT_NAME: "user.email",
  sendMainEmailVerificationContractEmail,
}));

beforeEach(() => {
  sendMainEmailVerificationContractEmail.mockReset();
  sendMainEmailVerificationContractEmail.mockResolvedValue({ ok: true });
  userFindUniqueOrThrow.mockReset();
  userFindUniqueOrThrow.mockResolvedValue({ email: "old@example.com" });
  userUpdate.mockReset();
  userUpdate.mockResolvedValue(undefined);
  contractFindUnique.mockReset();
  contractFindUnique.mockResolvedValue(null);
  contractFindFirst.mockReset();
  contractFindFirst.mockResolvedValue(null);
  contractUpdate.mockReset();
  contractUpdate.mockResolvedValue({
    email: "new@example.com",
    status: "VERIFIED",
    expiresAt: new Date(Date.now() + 60_000),
    lastSentAt: new Date(),
  });
  contractUpsert.mockReset();
  contractUpsert.mockImplementation(async (args: any) => ({
    email: args.create.email,
    status: "PENDING",
    expiresAt: args.create.expiresAt,
    lastSentAt: args.create.lastSentAt,
  }));
  transaction.mockReset();
  transaction.mockImplementation(async (callback: any) =>
    callback({
      user: { update: userUpdate },
      emailVerificationContract: { update: contractUpdate },
    }),
  );
});

describe("user email verification contracts", () => {
  test("creates a pending contract without overwriting User.email", async () => {
    const { requestUserEmailVerification } =
      await import("./user-email-verification.service");

    const response = await requestUserEmailVerification(
      "user-1",
      " New@Example.com ",
    );

    expect(response).toMatchObject({
      success: true,
      state: {
        email: "old@example.com",
        pendingEmail: "new@example.com",
        contractStatus: "PENDING",
      },
    });
    expect(sendMainEmailVerificationContractEmail).toHaveBeenCalledWith({
      to: "new@example.com",
      code: expect.stringMatching(/^\d{6}$/),
    });
    expect(contractUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          contractName: "user.email",
          ownerId: "user-1",
          email: "new@example.com",
          status: "PENDING",
          deliveryStatus: "SENT",
        }),
      }),
    );
    expect(userUpdate).not.toHaveBeenCalled();
  });

  test("verifies a pending contract and writes User.email", async () => {
    const { requestUserEmailVerification, verifyUserEmailContract } =
      await import("./user-email-verification.service");

    await requestUserEmailVerification("user-1", "new@example.com");
    const sent = (
      sendMainEmailVerificationContractEmail.mock.calls as any
    )[0][0] as {
      code: string;
    };
    const upsertArgs = (contractUpsert.mock.calls as any)[0][0] as {
      create: { codeHash: string; expiresAt: Date; lastSentAt: Date };
    };
    contractFindUnique.mockResolvedValueOnce({
      id: "contract-1",
      email: "new@example.com",
      status: "PENDING",
      codeHash: upsertArgs.create.codeHash,
      expiresAt: upsertArgs.create.expiresAt,
      lastSentAt: upsertArgs.create.lastSentAt,
    } as any);
    contractUpdate.mockResolvedValueOnce({
      email: "new@example.com",
      status: "VERIFIED",
      expiresAt: upsertArgs.create.expiresAt,
      lastSentAt: upsertArgs.create.lastSentAt,
    });

    const response = await verifyUserEmailContract({
      userId: "user-1",
      email: "new@example.com",
      code: sent.code,
    });

    expect(response).toMatchObject({
      success: true,
      state: {
        email: "new@example.com",
        verified: true,
        contractStatus: "VERIFIED",
      },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { unitId: "user-1" },
      data: { email: "new@example.com" },
    });
    expect(contractUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "contract-1" },
        data: expect.objectContaining({
          status: "VERIFIED",
          codeHash: null,
        }),
      }),
    );
  });
});
