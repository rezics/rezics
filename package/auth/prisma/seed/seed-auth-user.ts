import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "../generated/client";
import { generatePassword } from "./helpers";

export interface SeedAuthUserInput {
  email: string;
  name: string;
  role?: string;
  password?: string;
}

export interface SeedAuthUserResult {
  userId: string;
  email: string;
  name: string;
  role: string;
  password: string;
}

export async function seedAuthUser(
  prisma: PrismaClient,
  input: SeedAuthUserInput,
): Promise<SeedAuthUserResult> {
  const role = input.role ?? "user";
  const password = input.password ?? generatePassword();
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      role,
      emailVerified: true,
    },
    create: {
      name: input.name,
      email: input.email,
      role,
      emailVerified: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  await prisma.account.upsert({
    where: {
      providerId_accountId: {
        providerId: "credential",
        accountId: user.id,
      },
    },
    update: {
      userId: user.id,
      password: passwordHash,
    },
    create: {
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: passwordHash,
    },
  });

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    password,
  };
}
