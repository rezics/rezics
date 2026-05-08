import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import type {
  UserEmailVerificationResponse,
  UserEmailVerificationState,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import {
  sendMainEmailVerificationContractEmail,
  USER_EMAIL_CONTRACT_NAME,
} from "./main-email-verification.service";

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

type UserEmailContract = {
  email: string;
  status: "PENDING" | "VERIFIED" | "EXPIRED";
  expiresAt: Date | null;
  lastSentAt: Date | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createVerificationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashCode(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

function codeMatches(inputCode: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const actual = Buffer.from(hashCode(inputCode), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function mapState(input: {
  email: string | null;
  contract: UserEmailContract | null;
}): UserEmailVerificationState {
  const verified =
    Boolean(input.email) &&
    input.contract?.email === input.email &&
    input.contract.status === "VERIFIED";

  return {
    email: input.email ?? undefined,
    verified,
    pendingEmail:
      input.contract?.status === "PENDING" ? input.contract.email : undefined,
    contractStatus: input.contract?.status,
    expiresAt: input.contract?.expiresAt ?? undefined,
    lastSentAt: input.contract?.lastSentAt ?? undefined,
  };
}

async function getLatestUserEmailContract(
  userId: string,
): Promise<UserEmailContract | null> {
  const contract = await prisma.emailVerificationContract.findFirst({
    where: {
      ownerId: userId,
      contractName: USER_EMAIL_CONTRACT_NAME,
      status: { in: ["PENDING", "VERIFIED"] },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      email: true,
      status: true,
      expiresAt: true,
      lastSentAt: true,
    },
  });

  return contract as UserEmailContract | null;
}

export async function getUserEmailVerificationState(
  userId: string,
): Promise<UserEmailVerificationState> {
  const [user, contract] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { userId },
      select: { email: true },
    }),
    getLatestUserEmailContract(userId),
  ]);

  return mapState({ email: user.email, contract });
}

export async function requestUserEmailVerification(
  userId: string,
  rawEmail: string,
): Promise<UserEmailVerificationResponse> {
  const email = normalizeEmail(rawEmail);
  const now = new Date();

  const user = await prisma.user.findUniqueOrThrow({
    where: { userId },
    select: { email: true },
  });
  const verifiedContract = await prisma.emailVerificationContract.findUnique({
    where: {
      contractName_ownerId_email: {
        contractName: USER_EMAIL_CONTRACT_NAME,
        ownerId: userId,
        email,
      },
    },
    select: { email: true, status: true, expiresAt: true, lastSentAt: true },
  });

  if (user.email === email && verifiedContract?.status === "VERIFIED") {
    return {
      success: false,
      state: mapState({ email: user.email, contract: verifiedContract }),
      error: {
        code: "EMAIL_ALREADY_VERIFIED",
        message: "This Rezics email is already verified",
      },
    };
  }

  if (verifiedContract?.lastSentAt) {
    const elapsedMs = now.getTime() - verifiedContract.lastSentAt.getTime();
    if (elapsedMs < RESEND_COOLDOWN_MS) {
      return {
        success: false,
        state: mapState({ email: user.email, contract: verifiedContract }),
        error: {
          code: "COOLDOWN",
          message: "Please wait before requesting another verification code",
          retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000),
        },
      };
    }
  }

  const code = createVerificationCode();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
  const delivery = await sendMainEmailVerificationContractEmail({
    to: email,
    code,
  });

  if (!delivery.ok) {
    return {
      success: false,
      state: await getUserEmailVerificationState(userId),
      error: {
        code: "DELIVERY_FAILED",
        message: delivery.error.message,
      },
    };
  }

  const contract = await prisma.emailVerificationContract.upsert({
    where: {
      contractName_ownerId_email: {
        contractName: USER_EMAIL_CONTRACT_NAME,
        ownerId: userId,
        email,
      },
    },
    create: {
      contractName: USER_EMAIL_CONTRACT_NAME,
      ownerId: userId,
      email,
      status: "PENDING",
      codeHash: hashCode(code),
      deliveryStatus: "SENT",
      source: "main-email-code",
      expiresAt,
      lastSentAt: now,
      attempts: 1,
    },
    update: {
      status: "PENDING",
      codeHash: hashCode(code),
      deliveryStatus: "SENT",
      source: "main-email-code",
      expiresAt,
      lastSentAt: now,
      attempts: { increment: 1 },
    },
    select: {
      email: true,
      status: true,
      expiresAt: true,
      lastSentAt: true,
    },
  });

  return {
    success: true,
    state: mapState({ email: user.email, contract }),
  };
}

export async function verifyUserEmailContract(input: {
  userId: string;
  email: string;
  code: string;
}): Promise<UserEmailVerificationResponse> {
  const email = normalizeEmail(input.email);
  const now = new Date();

  const contract = await prisma.emailVerificationContract.findUnique({
    where: {
      contractName_ownerId_email: {
        contractName: USER_EMAIL_CONTRACT_NAME,
        ownerId: input.userId,
        email,
      },
    },
  });

  if (!contract) {
    return {
      success: false,
      state: await getUserEmailVerificationState(input.userId),
      error: {
        code: "CONTRACT_NOT_FOUND",
        message: "No verification contract exists for this email",
      },
    };
  }

  if (contract.status === "VERIFIED") {
    return {
      success: false,
      state: await getUserEmailVerificationState(input.userId),
      error: {
        code: "EMAIL_ALREADY_VERIFIED",
        message: "This Rezics email is already verified",
      },
    };
  }

  if (contract.expiresAt && contract.expiresAt.getTime() < now.getTime()) {
    const expired = await prisma.emailVerificationContract.update({
      where: { id: contract.id },
      data: { status: "EXPIRED" },
      select: {
        email: true,
        status: true,
        expiresAt: true,
        lastSentAt: true,
      },
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { userId: input.userId },
      select: { email: true },
    });
    return {
      success: false,
      state: mapState({ email: user.email, contract: expired }),
      error: {
        code: "EXPIRED_CODE",
        message: "Verification code has expired",
      },
    };
  }

  if (!codeMatches(input.code, contract.codeHash)) {
    return {
      success: false,
      state: await getUserEmailVerificationState(input.userId),
      error: {
        code: "INVALID_CODE",
        message: "Verification code is invalid",
      },
    };
  }

  const updated = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { userId: input.userId },
        data: { email },
      });
      return tx.emailVerificationContract.update({
        where: { id: contract.id },
        data: {
          status: "VERIFIED",
          verifiedAt: now,
          codeHash: null,
        },
        select: {
          email: true,
          status: true,
          expiresAt: true,
          lastSentAt: true,
        },
      });
    },
  );

  return {
    success: true,
    state: mapState({ email, contract: updated }),
  };
}
