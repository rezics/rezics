import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import type {
  UserEmailVerificationResponse,
  UserEmailVerificationState,
} from "@rezics/contract";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { EmailVerificationContract, User } from "../db/schema";
import {
  sendMainEmailVerificationContractEmail,
  USER_EMAIL_CONTRACT_NAME,
} from "./main-email-verification.service";

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

type UserEmailContract = {
  id?: string;
  email: string;
  status: "PENDING" | "VERIFIED" | "EXPIRED";
  codeHash?: string | null;
  expiresAt: Date | null;
  lastSentAt: Date | null;
};

type EmailContractData = {
  contractName: string;
  ownerId: string;
  email: string;
  status: "PENDING";
  codeHash: string;
  deliveryStatus: string;
  source: string;
  expiresAt: Date;
  lastSentAt: Date;
};

export type UserEmailVerificationRepository = {
  findUserEmail(userId: string): Promise<string | null>;
  findLatestUserEmailContract(
    userId: string,
  ): Promise<UserEmailContract | null>;
  findContract(input: {
    contractName: string;
    ownerId: string;
    email: string;
  }): Promise<UserEmailContract | null>;
  upsertPendingContract(data: EmailContractData): Promise<UserEmailContract>;
  updateContractStatus(
    id: string,
    data: Partial<Pick<UserEmailContract, "status" | "codeHash">> & {
      verifiedAt?: Date;
    },
  ): Promise<UserEmailContract>;
  verifyContractAndUpdateUser(input: {
    userId: string;
    email: string;
    contractId: string;
    verifiedAt: Date;
  }): Promise<UserEmailContract>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function toContract(row: typeof EmailVerificationContract.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    status: row.status,
    codeHash: row.codeHash,
    expiresAt: row.expiresAt,
    lastSentAt: row.lastSentAt,
  } satisfies UserEmailContract;
}

function createDrizzleUserEmailVerificationRepository(): UserEmailVerificationRepository {
  return {
    async findUserEmail(userId) {
      const db = await getServerDb();
      const [user] = await db
        .select({ email: User.email })
        .from(User)
        .where(eq(User.unitId, userId))
        .limit(1);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }
      return user.email;
    },

    async findLatestUserEmailContract(userId) {
      const db = await getServerDb();
      const [contract] = await db
        .select()
        .from(EmailVerificationContract)
        .where(
          and(
            eq(EmailVerificationContract.ownerId, userId),
            eq(
              EmailVerificationContract.contractName,
              USER_EMAIL_CONTRACT_NAME,
            ),
            inArray(EmailVerificationContract.status, ["PENDING", "VERIFIED"]),
          ),
        )
        .orderBy(desc(EmailVerificationContract.updatedAt))
        .limit(1);
      return contract ? toContract(contract) : null;
    },

    async findContract({ contractName, ownerId, email }) {
      const db = await getServerDb();
      const [contract] = await db
        .select()
        .from(EmailVerificationContract)
        .where(
          and(
            eq(EmailVerificationContract.contractName, contractName),
            eq(EmailVerificationContract.ownerId, ownerId),
            eq(EmailVerificationContract.email, email),
          ),
        )
        .limit(1);
      return contract ? toContract(contract) : null;
    },

    async upsertPendingContract(data) {
      const db = await getServerDb();
      const now = new Date();
      const [contract] = await db
        .insert(EmailVerificationContract)
        .values({
          id: sql`uuidv7()`,
          ...data,
          attempts: 1,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            EmailVerificationContract.contractName,
            EmailVerificationContract.ownerId,
            EmailVerificationContract.email,
          ],
          set: {
            status: data.status,
            codeHash: data.codeHash,
            deliveryStatus: data.deliveryStatus,
            source: data.source,
            expiresAt: data.expiresAt,
            lastSentAt: data.lastSentAt,
            attempts: sql`${EmailVerificationContract.attempts} + 1`,
            updatedAt: now,
          },
        })
        .returning();
      if (!contract) {
        throw new Error("Email verification contract was not saved");
      }
      return toContract(contract);
    },

    async updateContractStatus(id, data) {
      const db = await getServerDb();
      const [contract] = await db
        .update(EmailVerificationContract)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(EmailVerificationContract.id, id))
        .returning();
      if (!contract) {
        throw new Error(`Email verification contract not found: ${id}`);
      }
      return toContract(contract);
    },

    async verifyContractAndUpdateUser({
      userId,
      email,
      contractId,
      verifiedAt,
    }) {
      const db = await getServerDb();
      return db.transaction(async (tx) => {
        await tx.update(User).set({ email }).where(eq(User.unitId, userId));
        const [contract] = await tx
          .update(EmailVerificationContract)
          .set({
            status: "VERIFIED",
            verifiedAt,
            codeHash: null,
            updatedAt: new Date(),
          })
          .where(eq(EmailVerificationContract.id, contractId))
          .returning();
        if (!contract) {
          throw new Error(
            `Email verification contract not found: ${contractId}`,
          );
        }
        return toContract(contract);
      });
    },
  };
}

const defaultRepository = createDrizzleUserEmailVerificationRepository();

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
  repository: UserEmailVerificationRepository = defaultRepository,
): Promise<UserEmailContract | null> {
  return repository.findLatestUserEmailContract(userId);
}

export async function getUserEmailVerificationState(
  userId: string,
  repository: UserEmailVerificationRepository = defaultRepository,
): Promise<UserEmailVerificationState> {
  const [email, contract] = await Promise.all([
    repository.findUserEmail(userId),
    getLatestUserEmailContract(userId, repository),
  ]);

  return mapState({ email, contract });
}

export async function requestUserEmailVerification(
  userId: string,
  rawEmail: string,
  repository: UserEmailVerificationRepository = defaultRepository,
): Promise<UserEmailVerificationResponse> {
  const email = normalizeEmail(rawEmail);
  const now = new Date();

  const userEmail = await repository.findUserEmail(userId);
  const verifiedContract = await repository.findContract({
    contractName: USER_EMAIL_CONTRACT_NAME,
    ownerId: userId,
    email,
  });

  if (userEmail === email && verifiedContract?.status === "VERIFIED") {
    return {
      success: false,
      state: mapState({ email: userEmail, contract: verifiedContract }),
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
        state: mapState({ email: userEmail, contract: verifiedContract }),
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
      state: await getUserEmailVerificationState(userId, repository),
      error: {
        code: "DELIVERY_FAILED",
        message: delivery.error.message,
      },
    };
  }

  const contract = await repository.upsertPendingContract({
    contractName: USER_EMAIL_CONTRACT_NAME,
    ownerId: userId,
    email,
    status: "PENDING",
    codeHash: hashCode(code),
    deliveryStatus: "SENT",
    source: "main-email-code",
    expiresAt,
    lastSentAt: now,
  });

  return {
    success: true,
    state: mapState({ email: userEmail, contract }),
  };
}

export async function verifyUserEmailContract(input: {
  userId: string;
  email: string;
  code: string;
  repository?: UserEmailVerificationRepository;
}): Promise<UserEmailVerificationResponse> {
  const email = normalizeEmail(input.email);
  const repository = input.repository ?? defaultRepository;
  const now = new Date();

  const contract = await repository.findContract({
    contractName: USER_EMAIL_CONTRACT_NAME,
    ownerId: input.userId,
    email,
  });

  if (!contract) {
    return {
      success: false,
      state: await getUserEmailVerificationState(input.userId, repository),
      error: {
        code: "CONTRACT_NOT_FOUND",
        message: "No verification contract exists for this email",
      },
    };
  }

  if (contract.status === "VERIFIED") {
    return {
      success: false,
      state: await getUserEmailVerificationState(input.userId, repository),
      error: {
        code: "EMAIL_ALREADY_VERIFIED",
        message: "This Rezics email is already verified",
      },
    };
  }

  if (contract.expiresAt && contract.expiresAt.getTime() < now.getTime()) {
    const expired = await repository.updateContractStatus(contract.id!, {
      status: "EXPIRED",
    });
    const userEmail = await repository.findUserEmail(input.userId);
    return {
      success: false,
      state: mapState({ email: userEmail, contract: expired }),
      error: {
        code: "EXPIRED_CODE",
        message: "Verification code has expired",
      },
    };
  }

  if (!codeMatches(input.code, contract.codeHash ?? null)) {
    return {
      success: false,
      state: await getUserEmailVerificationState(input.userId, repository),
      error: {
        code: "INVALID_CODE",
        message: "Verification code is invalid",
      },
    };
  }

  const updated = await repository.verifyContractAndUpdateUser({
    userId: input.userId,
    email,
    contractId: contract.id!,
    verifiedAt: now,
  });

  return {
    success: true,
    state: mapState({ email, contract: updated }),
  };
}
