import { afterEach, describe, expect, mock, test } from "bun:test";

const bootstrapMock = mock(async () => {});

mock.module("@rezics/server/prisma/factory/system-shelves", () => ({
  bootstrapSystemShelves: bootstrapMock,
}));

afterEach(() => {
  bootstrapMock.mockClear();
});

function makePrismaStub() {
  return {
    $transaction: mock(async (callback: any) =>
      callback({
        $queryRaw: mock(async () => [{ id: "generated-infra-user" }]),
        unit: {
          create: mock(async () => ({})),
        },
      }),
    ),
    unit: {
      findUnique: mock(async () => null),
      upsert: mock(async () => ({})),
      update: mock(async () => ({})),
    },
    user: {
      upsert: mock(async () => ({})),
    },
  };
}

describe("seedAllMainUsers", () => {
  test("calls bootstrapSystemShelves for every fixture user with its slug", async () => {
    const { SEED_USERS, seedAllMainUsers } = await import("./users");

    const authResults = new Map(
      SEED_USERS.map((input) => [
        input.email,
        {
          userId: `unit-${input.email}`,
          email: input.email,
          name: input.name,
          authUserId: `unit-${input.email}`,
          slug: input.slug ?? input.name.toLowerCase().replace(/\s+/g, "-"),
          password: "x",
        } as any,
      ]),
    );

    const prismaStub = makePrismaStub();

    await seedAllMainUsers(
      prismaStub as any,
      authResults as any,
      { user: "user-scope" } as any,
    );

    expect(bootstrapMock).toHaveBeenCalledTimes(SEED_USERS.length);
    const callArgs = bootstrapMock.mock.calls as any[];
    const seenUserIds = callArgs.map((args) => args[0]);
    for (const input of SEED_USERS) {
      expect(seenUserIds).toContain(`unit-${input.email}`);
    }
    for (const args of callArgs) {
      expect(typeof args[1]).toBe("string");
      expect(args[1].length).toBeGreaterThan(0);
      expect(args[2]).toBe(prismaStub);
    }
  });

  test("seeds infra users without auth identity bindings", async () => {
    const { INFRA_USERS, seedInfraUsers } = await import("./users");
    const prismaStub = makePrismaStub();

    await seedInfraUsers(prismaStub as any, { user: "user-scope" } as any);

    expect(prismaStub.user.upsert).toHaveBeenCalledTimes(INFRA_USERS.length);
    for (const call of prismaStub.user.upsert.mock.calls as any[]) {
      const args = call[0];
      expect(args.create.authUserId).toBeNull();
      expect(args.update.authUserId).toBeNull();
      expect(args.create.email).toBeNull();
      expect(args.update.email).toBeNull();
    }
  });

  test("reuses existing infra user Units by slug", async () => {
    const { INFRA_USERS, seedInfraUsers } = await import("./users");
    const prismaStub = makePrismaStub();
    (prismaStub.unit as any).findUnique = mock(async ({ where }: any) => ({
      id: `existing-${where.slugScope_slug.slug}`,
      type: "USER",
    }));

    const result = await seedInfraUsers(
      prismaStub as any,
      { user: "user-scope" } as any,
    );

    expect(prismaStub.$transaction).not.toHaveBeenCalled();
    for (const input of INFRA_USERS) {
      expect(result[input.slug]).toBe(`existing-${input.slug}`);
    }
  });
});
