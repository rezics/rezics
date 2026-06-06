import { describe, expect, mock, test } from "bun:test";
import { verifyPassword } from "better-auth/crypto";

process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_auth";
process.env.BETTER_AUTH_URL ??= "http://localhost:35003";
process.env.AUTH_PUBLIC_BASE_URL ??= "http://localhost:35003";
process.env.AUTH_PUBLIC_ISSUER_URL ??= "http://localhost:35003";
process.env.BETTER_AUTH_SECRET ??=
  "better-auth-secret-for-tests-abcdefghijklmnopqrstuvwxyz";
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "internal-auth-gateway-test";
process.env.SMTP_HOST ??= "smtp.test";
process.env.SMTP_USER ??= "smtp-user";
process.env.SMTP_PASSWORD ??= "smtp-password";
process.env.TURNSTILE_SECRET ??= "turnstile-secret";

function createAuthDbStub(user: {
  id: string;
  name: string;
  email: string;
  role: string;
}) {
  const insertedValues: unknown[] = [];
  const onConflictDoUpdate = mock(() => ({
    returning: mock(async () => [user]),
  }));
  const values = mock((input: unknown) => {
    insertedValues.push(input);
    return { onConflictDoUpdate };
  });
  const insert = mock(() => ({ values }));

  return {
    database: { insert },
    insertedValues,
    insert,
    values,
    onConflictDoUpdate,
  };
}

describe("seedAuthUser", () => {
  test("factory-seeded mock user has credentials that verify against the Account hash", async () => {
    const { seedAuthUser } = await import("./seed-auth-user");
    const stub = createAuthDbStub({
      id: "user-1",
      name: "Mock Reader",
      email: "factory-mock@mock.rezics.local",
      role: "user",
    });

    const result = await seedAuthUser(
      {
        email: "factory-mock@mock.rezics.local",
        name: "Mock Reader",
      },
      stub.database as never,
    );
    const accountInsert = stub.insertedValues[1] as { password: string };

    expect(result.userId).toBe("user-1");
    expect(result.email).toBe("factory-mock@mock.rezics.local");
    expect(result.password).toMatch(/^.{8,}$/);
    expect(accountInsert.password).toBeTruthy();

    const verified = await verifyPassword({
      hash: accountInsert.password,
      password: result.password,
    });
    expect(verified).toBe(true);
  });

  test("two seeded users have distinct passwords and hashes", async () => {
    const { seedAuthUser } = await import("./seed-auth-user");
    const stubA = createAuthDbStub({
      id: "user-a",
      name: "User A",
      email: "a@mock.rezics.local",
      role: "user",
    });
    const stubB = createAuthDbStub({
      id: "user-b",
      name: "User B",
      email: "b@mock.rezics.local",
      role: "user",
    });

    const a = await seedAuthUser(
      { email: "a@mock.rezics.local", name: "User A" },
      stubA.database as never,
    );
    const b = await seedAuthUser(
      { email: "b@mock.rezics.local", name: "User B" },
      stubB.database as never,
    );
    const accountA = stubA.insertedValues[1] as { password: string };
    const accountB = stubB.insertedValues[1] as { password: string };

    expect(a.password).not.toBe(b.password);
    expect(accountA.password).not.toBe(accountB.password);
    expect(
      await verifyPassword({ hash: accountA.password, password: a.password }),
    ).toBe(true);
    expect(
      await verifyPassword({ hash: accountB.password, password: b.password }),
    ).toBe(true);
  });
});
