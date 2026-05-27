import { beforeEach, describe, expect, mock, test } from "bun:test";
import { collectEditorialPatchLeafPaths } from "@rezics/contract";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";
import { mapActualTranslationPatchPaths } from "@/unit/collaborative-metadata";

installPrismaClientMock();

const enqueueMock = mock(async (_command: any) => ({
  status: "created" as const,
}));
mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

// `entity.service.ts` calls `requireSlugScopeId("entity")` from infra/slug-scopes.
mock.module("@/infra/slug-scopes", () => ({
  getSlugScopeId: (name: string) =>
    name === "entity"
      ? "entity-scope-unit-id"
      : name === "user"
        ? "user-scope-unit-id"
        : null,
  requireSlugScopeId: (name: string) => {
    if (name === "entity") return "entity-scope-unit-id";
    if (name === "user") return "user-scope-unit-id";
    throw new Error(`unknown scope ${name}`);
  },
  pickSlugScope: () => "entity-scope-unit-id",
}));

mock.module("@/infra/infra-users", () => ({
  resolveRezicsWikiUserId: async () => "rezics-wiki-user",
}));

function makeEntityRow(overrides: Record<string, any> = {}) {
  const now = new Date("2026-05-16T00:00:00.000Z");
  return {
    unitId: overrides.unitId ?? "entity-1",
    kind: overrides.kind ?? "person",
    avatar: overrides.avatar ?? null,
    verified: overrides.verified ?? false,
    eligibleCreditRoles: overrides.eligibleCreditRoles ?? ["author"],
    eligibleSubjectRoles: overrides.eligibleSubjectRoles ?? ["about"],
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
          sourceUnitId: null,
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
    $queryRaw: mock(async () => [{ sequence: 1n }]),
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
    historyOutbox: {
      create: mock(async (args: any) => args.data),
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
  enqueueMock.mockClear();
});

describe("EntityService.create", () => {
  test("non-admin: stamps caller as owner and creates Unit + Entity + translations", async () => {
    freshMocks();
    const { entityService } = await import("./entity.service");

    const row = await entityService.create(
      {
        kind: "person",
        eligibleCreditRoles: ["author"],
        eligibleSubjectRoles: ["about"],
        translations: [{ language: "en", title: "Test Author" }],
      },
      { callerUnitId: "user-1", isAdmin: false },
    );

    expect(row.unitId).toBe("entity-1");
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "search.entity.sync",
        payload: { unitId: "entity-1" },
        source: { type: "server", service: "entity" },
      }),
    );
  });

  test("persists avatar on the Entity extension row", async () => {
    const { txClient } = freshMocks();
    const { entityService } = await import("./entity.service");

    await entityService.create(
      {
        kind: "person",
        avatar: "https://cdn.example/entity.png",
        eligibleCreditRoles: ["author"],
        eligibleSubjectRoles: ["about"],
        translations: [{ language: "en", title: "Test Author" }],
      },
      { callerUnitId: "user-1", isAdmin: false },
    );

    const createArgs = (txClient.unit.create as any).mock.calls[0]?.[0];
    expect(createArgs.data.entity.create.avatar).toBe(
      "https://cdn.example/entity.png",
    );
  });

  test("non-admin: rejects payload that includes slug", async () => {
    freshMocks();
    const { entityService } = await import("./entity.service");

    await expect(
      entityService.create(
        {
          kind: "person",
          slug: "test",
          eligibleCreditRoles: ["author"],
          eligibleSubjectRoles: ["about"],
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
          eligibleCreditRoles: ["author"],
          eligibleSubjectRoles: ["about"],
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
          eligibleCreditRoles: ["author"],
          eligibleSubjectRoles: ["about"],
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
          eligibleCreditRoles: ["author"],
          eligibleSubjectRoles: ["about"],
          translations: [{ language: "en", title: "Liu Cixin" }],
        },
        { callerUnitId: "admin-1", isAdmin: true },
      ),
    ).resolves.toBeDefined();
  });

  test("wiki creation stamps rezics-wiki as owner", async () => {
    const { txClient } = freshMocks();
    const { entityService } = await import("./entity.service");

    await entityService.create(
      {
        creationMode: "wiki",
        kind: "person",
        eligibleCreditRoles: ["author"],
        eligibleSubjectRoles: ["about"],
        translations: [{ language: "en", title: "Wiki Author" }],
      },
      { callerUnitId: "user-1", isAdmin: false },
    );

    const createArgs = (txClient.unit.create as any).mock.calls[0]?.[0];
    expect(createArgs.data.userId).toBe("rezics-wiki-user");
    expect(createArgs.data.fieldLocks).toBeUndefined();
  });

  test("wiki creation writes initial history with creator as actor", async () => {
    const { txClient } = freshMocks();
    const { entityService } = await import("./entity.service");

    await entityService.create(
      {
        creationMode: "wiki",
        kind: "person",
        eligibleCreditRoles: ["author"],
        eligibleSubjectRoles: ["about"],
        translations: [{ language: "en", title: "Wiki Author" }],
      },
      {
        callerUnitId: "user-1",
        isAdmin: false,
        actor: { userId: "user-1", permission: { role: "USER" } } as any,
      },
    );

    const historyArgs = (txClient.historyOutbox.create as any).mock
      .calls[0]?.[0];
    expect(txClient.historyOutbox.create).toHaveBeenCalledTimes(1);
    expect(historyArgs.data.actorUserId).toBe("user-1");
    expect(historyArgs.data.payload.revision.patch).toEqual({
      entity: {
        kind: "person",
        eligibleCreditRoles: ["author"],
        eligibleSubjectRoles: ["about"],
      },
      translations: { en: { title: "Wiki Author" } },
    });
  });

  test("personal creation keeps current user owner and starts closed", async () => {
    const { txClient } = freshMocks();
    const { entityService } = await import("./entity.service");

    await entityService.create(
      {
        creationMode: "personal",
        kind: "person",
        eligibleCreditRoles: ["author"],
        eligibleSubjectRoles: ["about"],
        translations: [{ language: "en", title: "Personal Author" }],
      },
      { callerUnitId: "user-1", isAdmin: false },
    );

    const createArgs = (txClient.unit.create as any).mock.calls[0]?.[0];
    expect(createArgs.data.userId).toBe("user-1");
    expect(createArgs.data.fieldLocks.create).toMatchObject({
      path: "*",
      lockedById: "user-1",
    });
  });

  test("personal creation writes initial history with creator as actor", async () => {
    const { txClient } = freshMocks();
    const { entityService } = await import("./entity.service");

    await entityService.create(
      {
        creationMode: "personal",
        kind: "person",
        eligibleCreditRoles: ["author"],
        eligibleSubjectRoles: ["about"],
        translations: [{ language: "en", title: "Personal Author" }],
      },
      {
        callerUnitId: "user-1",
        isAdmin: false,
        actor: { userId: "user-1", permission: { role: "USER" } } as any,
      },
    );

    const historyArgs = (txClient.historyOutbox.create as any).mock
      .calls[0]?.[0];
    expect(txClient.historyOutbox.create).toHaveBeenCalledTimes(1);
    expect(historyArgs.data.actorUserId).toBe("user-1");
    expect(historyArgs.data.payload.revision.patch).toEqual({
      entity: {
        kind: "person",
        eligibleCreditRoles: ["author"],
        eligibleSubjectRoles: ["about"],
      },
      translations: { en: { title: "Personal Author" } },
    });
  });

  test("create and edit projections produce identical editorial leaf paths", async () => {
    const { buildEntityCreatePatch, mapEntityUpdatePatchPaths } = await import(
      "./entity.service"
    );
    const translation = { language: "en", title: "Same State" };

    const createPaths = collectEditorialPatchLeafPaths(
      buildEntityCreatePatch({
        kind: "person",
        eligibleCreditRoles: ["author"],
        eligibleSubjectRoles: ["about"],
        translations: [translation],
      }),
    );
    const editPaths = [
      ...mapEntityUpdatePatchPaths({
        kind: "person",
        eligibleCreditRoles: ["author"],
        eligibleSubjectRoles: ["about"],
        translations: [translation],
      }),
      ...mapActualTranslationPatchPaths(translation, null, "en"),
    ].sort();

    expect(createPaths.sort()).toEqual([...new Set(editPaths)]);
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

  test("non-admin: avatar update succeeds and records avatar field key", async () => {
    const { txClient } = freshMocks();
    const { entityService, mapEntityUpdatePatchPaths } = await import(
      "./entity.service"
    );

    await expect(
      entityService.update(
        "entity-1",
        { avatar: "https://cdn.example/new.png" },
        { callerUnitId: "user-1", isAdmin: false },
      ),
    ).resolves.toBeDefined();

    const updateArgs = (txClient.entity.update as any).mock.calls[0]?.[0];
    expect(updateArgs.data.avatar).toBe("https://cdn.example/new.png");
    expect(mapEntityUpdatePatchPaths({ avatar: null })).toContain(
      "entity.avatar",
    );
  });

  test("non-admin: eligibility update succeeds and records eligibility field keys", async () => {
    const { txClient } = freshMocks();
    const { entityService, mapEntityUpdatePatchPaths } = await import(
      "./entity.service"
    );

    await expect(
      entityService.update(
        "entity-1",
        {
          eligibleCreditRoles: ["translator"],
          eligibleSubjectRoles: ["about", "appears"],
        },
        { callerUnitId: "user-1", isAdmin: false },
      ),
    ).resolves.toBeDefined();

    const updateArgs = (txClient.entity.update as any).mock.calls[0]?.[0];
    expect(updateArgs.data.eligibleCreditRoles).toEqual(["translator"]);
    expect(updateArgs.data.eligibleSubjectRoles).toEqual(["about", "appears"]);
    expect(
      mapEntityUpdatePatchPaths({ eligibleCreditRoles: ["author"] }),
    ).toContain("entity.eligibleCreditRoles");
    expect(
      mapEntityUpdatePatchPaths({ eligibleSubjectRoles: ["about"] }),
    ).toContain("entity.eligibleSubjectRoles");
  });
});

describe("EntityService.delete", () => {
  test("removes the parent Unit and syncs the index removal", async () => {
    freshMocks();
    const { entityService } = await import("./entity.service");

    await entityService.delete("entity-1");

    expect((prismaMock.unit.delete as any).mock.calls.length).toBe(1);
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "search.entity.delete",
        payload: { unitId: "entity-1" },
        source: { type: "server", service: "entity" },
      }),
    );
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
