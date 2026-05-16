import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

// Stub the Meili sync helpers so the suite never hits a real search client.
const syncEntityToMeili = mock(async (_unitId: string) => {});
const deleteEntityFromMeili = mock(async (_unitId: string) => {});
mock.module("@/meili/entity/sync", () => ({
  syncEntityToMeili,
  deleteEntityFromMeili,
  syncAllEntitiesToMeili: async () => ({ totalSynced: 0, message: "ok" }),
}));

// `entity.service.ts` calls `requireSlugScopeId("entity")` from infra/slug-scopes.
mock.module("@/infra/slug-scopes", () => ({
  getSlugScopeId: (name: string) =>
    name === "entity" ? "entity-scope-unit-id" : null,
  requireSlugScopeId: (name: string) => {
    if (name === "entity") return "entity-scope-unit-id";
    throw new Error(`unknown scope ${name}`);
  },
  pickSlugScope: () => "entity-scope-unit-id",
}));

function makeEntityRow(overrides: Record<string, any> = {}) {
  const now = new Date("2026-05-16T00:00:00.000Z");
  return {
    unitId: overrides.unitId ?? "entity-1",
    kind: overrides.kind ?? "person",
    verified: overrides.verified ?? false,
    unit: {
      id: overrides.unitId ?? "entity-1",
      type: "ENTITY",
      slug: overrides.slug ?? null,
      userId: overrides.userId ?? "user-1",
      createdAt: now,
      updatedAt: now,
      translations: overrides.translations ?? [
        {
          unitId: overrides.unitId ?? "entity-1",
          language: "en",
          title: "Test Author",
          subtitle: null,
          summary: null,
          description: null,
          extra: null,
          sourceReleaseUnitId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
  };
}

function freshMocks() {
  const entityRow = makeEntityRow();
  const txClient = {
    unit: {
      create: mock(async ({ data }: any) => ({
        id: "entity-1",
        type: "ENTITY",
        slug: data.slug ?? null,
        slugScope: data.slugScope,
        userId: data.userId,
      })),
      update: mock(async ({ data }: any) => ({
        id: "entity-1",
        slug: data.slug ?? null,
      })),
    },
    entity: {
      update: mock(async () => entityRow),
      findUniqueOrThrow: mock(async () => entityRow),
    },
    unitTranslation: {
      upsert: mock(async () => ({})),
    },
  };

  const findEntityResult = { verified: false } as { verified: boolean };
  Object.assign(prismaMock, {
    $transaction: mock(async (cb: any) => cb(txClient)),
    entity: {
      findUniqueOrThrow: mock(async () => entityRow),
      findUnique: mock(async () => entityRow),
      findMany: mock(async () => [entityRow]),
      count: mock(async () => 1),
    },
    unit: {
      findUnique: mock(async () => ({
        id: "entity-1",
        type: "ENTITY",
      })),
      delete: mock(async () => ({})),
    },
  });

  return { txClient, entityRow, findEntityResult };
}

beforeEach(() => {
  syncEntityToMeili.mockClear();
  deleteEntityFromMeili.mockClear();
});

describe("EntityService.create", () => {
  test("non-admin: stamps caller as owner and creates Unit + Entity + translations", async () => {
    freshMocks();
    const { entityService } = await import("./entity.service");

    const row = await entityService.create(
      {
        kind: "person",
        translations: [{ language: "en", title: "Test Author" }],
      },
      { callerUnitId: "user-1", isAdmin: false },
    );

    expect(row.unitId).toBe("entity-1");
    expect(syncEntityToMeili).toHaveBeenCalledWith("entity-1");
  });

  test("non-admin: rejects payload that includes slug", async () => {
    freshMocks();
    const { entityService } = await import("./entity.service");

    await expect(
      entityService.create(
        {
          kind: "person",
          slug: "test",
          translations: [{ language: "en", title: "T" }],
        },
        { callerUnitId: "user-1", isAdmin: false },
      ),
    ).rejects.toThrow(/entity_slug_admin_only/);
  });

  test("non-admin: rejects payload that includes verified", async () => {
    freshMocks();
    const { entityService } = await import("./entity.service");

    await expect(
      entityService.create(
        {
          kind: "person",
          verified: true,
          translations: [{ language: "en", title: "T" }],
        },
        { callerUnitId: "user-1", isAdmin: false },
      ),
    ).rejects.toThrow(/entity_verified_admin_only/);
  });

  test("admin: rejects slug without verified=true in same payload", async () => {
    freshMocks();
    const { entityService } = await import("./entity.service");

    await expect(
      entityService.create(
        {
          kind: "person",
          slug: "test",
          translations: [{ language: "en", title: "T" }],
        },
        { callerUnitId: "admin-1", isAdmin: true },
      ),
    ).rejects.toThrow(/entity_slug_requires_verified/);
  });

  test("admin: accepts slug when verified=true in same payload", async () => {
    freshMocks();
    const { entityService } = await import("./entity.service");

    await expect(
      entityService.create(
        {
          kind: "person",
          slug: "liu-cixin",
          verified: true,
          translations: [{ language: "en", title: "Liu Cixin" }],
        },
        { callerUnitId: "admin-1", isAdmin: true },
      ),
    ).resolves.toBeDefined();
  });
});

describe("EntityService.update", () => {
  test("non-admin: rejects slug update", async () => {
    freshMocks();
    const { entityService } = await import("./entity.service");

    await expect(
      entityService.update(
        "entity-1",
        { slug: "test" },
        { callerUnitId: "user-1", isAdmin: false },
      ),
    ).rejects.toThrow(/entity_slug_admin_only/);
  });

  test("non-admin: rejects verified toggle", async () => {
    freshMocks();
    const { entityService } = await import("./entity.service");

    await expect(
      entityService.update(
        "entity-1",
        { verified: true },
        { callerUnitId: "user-1", isAdmin: false },
      ),
    ).rejects.toThrow(/entity_verified_admin_only/);
  });

  test("admin: rejects slug when entity is not verified and payload does not verify", async () => {
    const mocks = freshMocks();
    (prismaMock.entity.findUniqueOrThrow as any).mockImplementation(
      async () => ({ verified: false }),
    );
    void mocks;
    const { entityService } = await import("./entity.service");

    await expect(
      entityService.update(
        "entity-1",
        { slug: "test" },
        { callerUnitId: "admin-1", isAdmin: true },
      ),
    ).rejects.toThrow(/entity_slug_requires_verified/);
  });

  test("admin: accepts slug when entity is already verified", async () => {
    freshMocks();
    (prismaMock.entity.findUniqueOrThrow as any).mockImplementation(
      async () => ({ verified: true }),
    );
    const { entityService } = await import("./entity.service");

    await expect(
      entityService.update(
        "entity-1",
        { slug: "liu-cixin" },
        { callerUnitId: "admin-1", isAdmin: true },
      ),
    ).resolves.toBeDefined();
  });

  test("admin: revoking verified does NOT clear an existing slug", async () => {
    const mocks = freshMocks();
    const { entityService } = await import("./entity.service");

    await entityService.update(
      "entity-1",
      { verified: false },
      { callerUnitId: "admin-1", isAdmin: true },
    );

    // No call to tx.unit.update with `slug: null` should have happened — the
    // payload only flipped `verified`, so the Unit row is left untouched.
    expect((mocks.txClient.unit.update as any).mock.calls.length).toBe(0);
  });

  test("non-admin: kind/translation update succeeds (no privileged fields)", async () => {
    freshMocks();
    const { entityService } = await import("./entity.service");

    await expect(
      entityService.update(
        "entity-1",
        { kind: "circle" },
        { callerUnitId: "user-1", isAdmin: false },
      ),
    ).resolves.toBeDefined();
  });
});

describe("EntityService.delete", () => {
  test("removes the parent Unit and syncs the index removal", async () => {
    freshMocks();
    const { entityService } = await import("./entity.service");

    await entityService.delete("entity-1");

    expect((prismaMock.unit.delete as any).mock.calls.length).toBe(1);
    expect(deleteEntityFromMeili).toHaveBeenCalledWith("entity-1");
  });
});

describe("EntityService.list", () => {
  test("kind filter passes through to the Prisma where clause", async () => {
    freshMocks();
    const { entityService } = await import("./entity.service");

    await entityService.list({ kind: "person" });

    const findCall = (prismaMock.entity.findMany as any).mock.calls[0]?.[0];
    expect(findCall?.where?.kind).toBe("person");
  });

  test("ownerUnitId filter goes through the joined Unit clause", async () => {
    freshMocks();
    const { entityService } = await import("./entity.service");

    await entityService.list({ ownerUnitId: "user-1" });

    const findCall = (prismaMock.entity.findMany as any).mock.calls[0]?.[0];
    const unitClause = findCall?.where?.unit;
    const flat = unitClause?.userId ?? unitClause?.AND?.[0]?.userId;
    expect(flat).toBe("user-1");
  });
});

describe("EntityService.getBySlug", () => {
  test("returns null when no Unit carries the slug", async () => {
    freshMocks();
    (prismaMock.unit.findUnique as any).mockImplementation(async () => null);
    const { entityService } = await import("./entity.service");

    const row = await entityService.getBySlug("missing");
    expect(row).toBeNull();
  });

  test("returns null when the slug resolves to a non-ENTITY Unit", async () => {
    freshMocks();
    (prismaMock.unit.findUnique as any).mockImplementation(async () => ({
      id: "user-1",
      type: "USER",
    }));
    const { entityService } = await import("./entity.service");

    const row = await entityService.getBySlug("alice");
    expect(row).toBeNull();
  });
});
