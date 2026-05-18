import { describe, expect, mock, test } from "bun:test";
import { verifyPassword } from "better-auth/crypto";
import type { PrismaClient } from "../generated/client";
import { seedAuthUser } from "./seed-auth-user";

describe("seedAuthUser", () => {
  test("factory-seeded mock user has credentials that verify against the Account hash", async () => {
    let storedHash: string | null = null;
    const userUpsert = mock(async () => ({
      id: "user-1",
      name: "Mock Reader",
      email: "factory-mock@mock.rezics.local",
      role: "user",
    }));
    const accountUpsert = mock(
      async (args: { create: { password: string } }) => {
        storedHash = args.create.password;
        return { id: "account-1" };
      },
    );

    const prismaMock = {
      user: { upsert: userUpsert },
      account: { upsert: accountUpsert },
    } as unknown as PrismaClient;

    const result = await seedAuthUser(prismaMock, {
      email: "factory-mock@mock.rezics.local",
      name: "Mock Reader",
    });

    expect(result.userId).toBe("user-1");
    expect(result.email).toBe("factory-mock@mock.rezics.local");
    expect(result.password).toMatch(/^.{8,}$/);
    expect(storedHash).not.toBeNull();

    const verified = await verifyPassword({
      hash: storedHash!,
      password: result.password,
    });
    expect(verified).toBe(true);
  });

  test("two seeded users have distinct passwords and hashes", async () => {
    const hashes: string[] = [];
    const upsertUser = (id: string, email: string) =>
      mock(async () => ({
        id,
        name: `User ${id}`,
        email,
        role: "user",
      }));
    const captureAccount = mock(
      async (args: { create: { password: string } }) => {
        hashes.push(args.create.password);
        return { id: `account-${hashes.length}` };
      },
    );

    const prismaA = {
      user: { upsert: upsertUser("user-a", "a@mock.rezics.local") },
      account: { upsert: captureAccount },
    } as unknown as PrismaClient;
    const prismaB = {
      user: { upsert: upsertUser("user-b", "b@mock.rezics.local") },
      account: { upsert: captureAccount },
    } as unknown as PrismaClient;

    const a = await seedAuthUser(prismaA, {
      email: "a@mock.rezics.local",
      name: "User A",
    });
    const b = await seedAuthUser(prismaB, {
      email: "b@mock.rezics.local",
      name: "User B",
    });

    expect(a.password).not.toBe(b.password);
    expect(hashes[0]).not.toBe(hashes[1]);
    expect(
      await verifyPassword({ hash: hashes[0]!, password: a.password }),
    ).toBe(true);
    expect(
      await verifyPassword({ hash: hashes[1]!, password: b.password }),
    ).toBe(true);
  });
});
