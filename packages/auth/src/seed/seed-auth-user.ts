import { hashPassword } from "better-auth/crypto";
import type { AuthDb } from "../db/client";
import { accounts, users } from "../db/schema";
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

async function resolveAuthDb(database?: AuthDb): Promise<AuthDb> {
  if (database) return database;
  const { db } = await import("../db/client");
  return db;
}

export async function seedAuthUser(
  input: SeedAuthUserInput,
  database?: AuthDb,
): Promise<SeedAuthUserResult> {
  const targetDb = await resolveAuthDb(database);
  const role = input.role ?? "user";
  const password = input.password ?? generatePassword();
  const passwordHash = await hashPassword(password);
  const now = new Date();

  const [user] = await targetDb
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      role,
      emailVerified: true,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        role,
        emailVerified: true,
        updatedAt: now,
      },
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    });
  if (!user) throw new Error(`Failed to seed auth user ${input.email}`);

  await targetDb
    .insert(accounts)
    .values({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: passwordHash,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [accounts.providerId, accounts.accountId],
      set: {
        userId: user.id,
        password: passwordHash,
        updatedAt: now,
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
