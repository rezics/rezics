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
    unit: {
      upsert: mock(async () => ({})),
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
});
