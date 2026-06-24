import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserEmailVerificationRepository } from "./user-email-verification.service";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const sendMainEmailVerificationContractEmail = mock(async () => ({ ok: true }));
const userEmail = mock(async () => "old@example.com");
const findContract = mock(
  async (): Promise<
    UserEmailVerificationRepository["findContract"] extends (
      ...args: any
    ) => Promise<infer Result>
      ? Result
      : never
  > => null,
);
const findLatestUserEmailContract = mock(async () => null);
const updateContractStatus = mock(async () => ({
  id: "contract-1",
  email: "new@example.com",
  status: "VERIFIED" as const,
  expiresAt: new Date(Date.now() + 60_000),
  lastSentAt: new Date(),
  codeHash: null,
}));
const upsertPendingContract = mock(async (data: any) => ({
  id: "contract-1",
  email: data.email,
  status: "PENDING" as const,
  expiresAt: data.expiresAt,
  lastSentAt: data.lastSentAt,
  codeHash: data.codeHash,
}));
const verifyContractAndUpdateUser = mock(
  async ({ email }: { email: string }) => ({
    id: "contract-1",
    email,
    status: "VERIFIED" as const,
    expiresAt: new Date(Date.now() + 60_000),
    lastSentAt: new Date(),
    codeHash: null,
  }),
);

mock.module("./main-email-verification.service", () => ({
  USER_EMAIL_CONTRACT_NAME: "user.email",
  sendMainEmailVerificationContractEmail,
}));

function repository(): UserEmailVerificationRepository {
  return {
    findUserEmail: userEmail,
    findLatestUserEmailContract,
    findContract,
    upsertPendingContract,
    updateContractStatus,
    verifyContractAndUpdateUser,
  };
}

beforeEach(() => {
  sendMainEmailVerificationContractEmail.mockReset();
  sendMainEmailVerificationContractEmail.mockResolvedValue({ ok: true });
  userEmail.mockReset();
  userEmail.mockResolvedValue("old@example.com");
  findContract.mockReset();
  findContract.mockResolvedValue(null);
  findLatestUserEmailContract.mockReset();
  findLatestUserEmailContract.mockResolvedValue(null);
  updateContractStatus.mockReset();
  updateContractStatus.mockResolvedValue({
    id: "contract-1",
    email: "new@example.com",
    status: "VERIFIED",
    expiresAt: new Date(Date.now() + 60_000),
    lastSentAt: new Date(),
    codeHash: null,
  });
  upsertPendingContract.mockReset();
  upsertPendingContract.mockImplementation(async (data: any) => ({
    id: "contract-1",
    email: data.email,
    status: "PENDING",
    expiresAt: data.expiresAt,
    lastSentAt: data.lastSentAt,
    codeHash: data.codeHash,
  }));
  verifyContractAndUpdateUser.mockReset();
  verifyContractAndUpdateUser.mockImplementation(
    async ({ email }: { email: string }) => ({
      id: "contract-1",
      email,
      status: "VERIFIED",
      expiresAt: new Date(Date.now() + 60_000),
      lastSentAt: new Date(),
      codeHash: null,
    }),
  );
});

describe("user email verification contracts", () => {
  test("creates a pending contract without overwriting User.email", async () => {
    const { requestUserEmailVerification } = await import(
      "./user-email-verification.service"
    );

    const response = await requestUserEmailVerification(
      "user-1",
      " New@Example.com ",
      repository(),
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
    expect(upsertPendingContract).toHaveBeenCalledWith(
      expect.objectContaining({
        contractName: "user.email",
        ownerId: "user-1",
        email: "new@example.com",
        status: "PENDING",
        deliveryStatus: "SENT",
      }),
    );
    expect(verifyContractAndUpdateUser).not.toHaveBeenCalled();
  });

  test("verifies a pending contract and writes User.email", async () => {
    const { requestUserEmailVerification, verifyUserEmailContract } =
      await import("./user-email-verification.service");
    const repo = repository();

    await requestUserEmailVerification("user-1", "new@example.com", repo);
    const sent = (
      sendMainEmailVerificationContractEmail.mock.calls as any
    )[0][0] as {
      code: string;
    };
    const upsertArgs = (upsertPendingContract.mock.calls as any)[0][0] as {
      codeHash: string;
      expiresAt: Date;
      lastSentAt: Date;
    };
    findContract.mockResolvedValueOnce({
      id: "contract-1",
      email: "new@example.com",
      status: "PENDING",
      codeHash: upsertArgs.codeHash,
      expiresAt: upsertArgs.expiresAt,
      lastSentAt: upsertArgs.lastSentAt,
    });

    const response = await verifyUserEmailContract({
      userId: "user-1",
      email: "new@example.com",
      code: sent.code,
      repository: repo,
    });

    expect(response).toMatchObject({
      success: true,
      state: {
        email: "new@example.com",
        verified: true,
        contractStatus: "VERIFIED",
      },
    });
    expect(verifyContractAndUpdateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        email: "new@example.com",
        contractId: "contract-1",
      }),
    );
  });
});
