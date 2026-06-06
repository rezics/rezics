import { beforeEach, describe, expect, mock, test } from "bun:test";
import { collectEditorialPatchLeafPaths } from "@rezics/contract";
import { mapActualTranslationPatchPaths } from "@/unit/collaborative-metadata";
import type {
  EntityCallerContext,
  EntityRepository,
  EntityService,
} from "./entity.service";
import type { EntityWithRelations } from "./entity.types";

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

function makeEntityRow(overrides: Partial<EntityWithRelations> = {}) {
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
      slug: null,
      slugScope: "entity-scope-unit-id",
      userId: "user-1",
      defaultLanguage: null,
      isLanguageNeutral: false,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      rating: "GENERAL",
      extra: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      subscriberCount: 0,
      licenseSlug: null,
      aiDisclosureMode: "UNKNOWN",
      aiDisclosureDetails: null,
      catalogEntryKind: null,
      targetUnitId: null,
      moderationStatus: "APPROVED",
      translations: [
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
    ...overrides,
  } satisfies EntityWithRelations;
}

function createRepositoryStub(
  overrides: Partial<EntityRepository> = {},
): EntityRepository {
  const row = makeEntityRow();
  return {
    create: mock(async () => row),
    getVerified: mock(async () => false),
    getCurrentMetadata: mock(async () => ({
      kind: row.kind,
      avatar: row.avatar,
      verified: row.verified,
      eligibleCreditRoles: row.eligibleCreditRoles,
      eligibleSubjectRoles: row.eligibleSubjectRoles,
      unit: {
        slug: row.unit.slug,
        translations: row.unit.translations,
      },
    })),
    update: mock(async ({ input }) =>
      makeEntityRow({
        kind: input.kind === undefined ? row.kind : (input.kind ?? null),
        avatar:
          input.avatar === undefined ? row.avatar : (input.avatar ?? null),
        verified: input.verified === undefined ? row.verified : input.verified,
        eligibleCreditRoles:
          input.eligibleCreditRoles ?? row.eligibleCreditRoles,
        eligibleSubjectRoles:
          input.eligibleSubjectRoles ?? row.eligibleSubjectRoles,
      }),
    ),
    delete: mock(async () => {}),
    getByUnitId: mock(async () => row),
    getBySlug: mock(async () => row),
    list: mock(async () => ({ rows: [row], total: 1 })),
    ...overrides,
  };
}

async function createService(repository: EntityRepository) {
  const module = await import(
    "./entity.service.ts?entity-service-test-actual" as string
  );
  return new module.EntityService(repository) as EntityService;
}

const userCtx: EntityCallerContext = { callerUnitId: "user-1", isAdmin: false };
const adminCtx: EntityCallerContext = {
  callerUnitId: "admin-1",
  isAdmin: true,
};

beforeEach(() => {
  enqueueMock.mockClear();
});

describe("EntityService.create", () => {
  test("non-admin: stamps caller as owner and creates Entity", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    const row = await service.create(
      {
        kind: "person",
        eligibleCreditRoles: ["author"],
        eligibleSubjectRoles: ["about"],
        translations: [{ language: "en", title: "Test Author" }],
      },
      userCtx,
    );

    expect(row.unitId).toBe("entity-1");
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: "user-1",
        entityScope: "entity-scope-unit-id",
      }),
    );
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "search.entity.sync",
        payload: { unitId: "entity-1" },
        source: { type: "server", service: "entity" },
      }),
    );
  });

  test("persists avatar through the create repository input", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.create(
      {
        kind: "person",
        avatar: "https://cdn.example/entity.png",
        eligibleCreditRoles: ["author"],
        eligibleSubjectRoles: ["about"],
        translations: [{ language: "en", title: "Test Author" }],
      },
      userCtx,
    );

    const createArgs = (repository.create as any).mock.calls[0]?.[0];
    expect(createArgs.input.avatar).toBe("https://cdn.example/entity.png");
  });

  test("non-admin: rejects payload that includes slug", async () => {
    const service = await createService(createRepositoryStub());

    await expect(
      service.create(
        {
          kind: "person",
          slug: "test",
          eligibleCreditRoles: ["author"],
          eligibleSubjectRoles: ["about"],
          translations: [{ language: "en", title: "T" }],
        },
        userCtx,
      ),
    ).rejects.toThrow(/entity_slug_admin_only/);
  });

  test("non-admin: rejects payload that includes verified", async () => {
    const service = await createService(createRepositoryStub());

    await expect(
      service.create(
        {
          kind: "person",
          verified: true,
          eligibleCreditRoles: ["author"],
          eligibleSubjectRoles: ["about"],
          translations: [{ language: "en", title: "T" }],
        },
        userCtx,
      ),
    ).rejects.toThrow(/entity_verified_admin_only/);
  });

  test("admin: rejects slug without verified=true in same payload", async () => {
    const service = await createService(createRepositoryStub());

    await expect(
      service.create(
        {
          kind: "person",
          slug: "test",
          eligibleCreditRoles: ["author"],
          eligibleSubjectRoles: ["about"],
          translations: [{ language: "en", title: "T" }],
        },
        adminCtx,
      ),
    ).rejects.toThrow(/entity_slug_requires_verified/);
  });

  test("admin: accepts slug when verified=true in same payload", async () => {
    const service = await createService(createRepositoryStub());

    await expect(
      service.create(
        {
          kind: "person",
          slug: "liu-cixin",
          verified: true,
          eligibleCreditRoles: ["author"],
          eligibleSubjectRoles: ["about"],
          translations: [{ language: "en", title: "Liu Cixin" }],
        },
        adminCtx,
      ),
    ).resolves.toBeDefined();
  });

  test("wiki creation stamps rezics-wiki as owner", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.create(
      {
        creationMode: "wiki",
        kind: "person",
        eligibleCreditRoles: ["author"],
        eligibleSubjectRoles: ["about"],
        translations: [{ language: "en", title: "Wiki Author" }],
      },
      userCtx,
    );

    const createArgs = (repository.create as any).mock.calls[0]?.[0];
    expect(createArgs.ownerUserId).toBe("rezics-wiki-user");
  });

  test("create with actor passes initial history patch", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.create(
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

    const createArgs = (repository.create as any).mock.calls[0]?.[0];
    expect(createArgs.actorUserId).toBe("user-1");
    expect(createArgs.historyPatch).toEqual({
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
      "./entity.service.ts?entity-service-test-actual" as string
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
    const service = await createService(createRepositoryStub());

    await expect(
      service.update("entity-1", { slug: "test" }, userCtx),
    ).rejects.toThrow(/entity_slug_admin_only/);
  });

  test("non-admin: rejects verified toggle", async () => {
    const service = await createService(createRepositoryStub());

    await expect(
      service.update("entity-1", { verified: true }, userCtx),
    ).rejects.toThrow(/entity_verified_admin_only/);
  });

  test("admin: rejects slug when entity is not verified and payload does not verify", async () => {
    const service = await createService(
      createRepositoryStub({ getVerified: mock(async () => false) }),
    );

    await expect(
      service.update("entity-1", { slug: "test" }, adminCtx),
    ).rejects.toThrow(/entity_slug_requires_verified/);
  });

  test("admin: accepts slug when entity is already verified", async () => {
    const service = await createService(
      createRepositoryStub({ getVerified: mock(async () => true) }),
    );

    await expect(
      service.update("entity-1", { slug: "liu-cixin" }, adminCtx),
    ).resolves.toBeDefined();
  });

  test("admin: revoking verified does NOT clear an existing slug", async () => {
    const verifiedRow = makeEntityRow({ verified: true });
    const repository = createRepositoryStub({
      getCurrentMetadata: mock(async () => ({
        kind: verifiedRow.kind,
        avatar: verifiedRow.avatar,
        verified: true,
        eligibleCreditRoles: verifiedRow.eligibleCreditRoles,
        eligibleSubjectRoles: verifiedRow.eligibleSubjectRoles,
        unit: {
          slug: "liu-cixin",
          translations: verifiedRow.unit.translations,
        },
      })),
    });
    const service = await createService(repository);

    await service.update("entity-1", { verified: false }, adminCtx);

    const updateArgs = (repository.update as any).mock.calls[0]?.[0];
    expect(updateArgs.input.slug).toBeUndefined();
  });

  test("non-admin: kind/translation update succeeds (no privileged fields)", async () => {
    const service = await createService(createRepositoryStub());

    await expect(
      service.update("entity-1", { kind: "circle" }, userCtx),
    ).resolves.toBeDefined();
  });

  test("non-admin: avatar update succeeds and records avatar field key", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);
    const { mapEntityUpdatePatchPaths } = await import(
      "./entity.service.ts?entity-service-test-actual" as string
    );

    await expect(
      service.update(
        "entity-1",
        { avatar: "https://cdn.example/new.png" },
        userCtx,
      ),
    ).resolves.toBeDefined();

    const updateArgs = (repository.update as any).mock.calls[0]?.[0];
    expect(updateArgs.input.avatar).toBe("https://cdn.example/new.png");
    expect(updateArgs.patchPaths).toContain("entity.avatar");
    expect(mapEntityUpdatePatchPaths({ avatar: null })).toContain(
      "entity.avatar",
    );
  });

  test("non-admin: eligibility update succeeds and records eligibility field keys", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);
    const { mapEntityUpdatePatchPaths } = await import(
      "./entity.service.ts?entity-service-test-actual" as string
    );

    await expect(
      service.update(
        "entity-1",
        {
          eligibleCreditRoles: ["translator"],
          eligibleSubjectRoles: ["about", "appears"],
        },
        userCtx,
      ),
    ).resolves.toBeDefined();

    const updateArgs = (repository.update as any).mock.calls[0]?.[0];
    expect(updateArgs.input.eligibleCreditRoles).toEqual(["translator"]);
    expect(updateArgs.input.eligibleSubjectRoles).toEqual(["about", "appears"]);
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
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.delete("entity-1");

    expect(repository.delete).toHaveBeenCalledWith("entity-1");
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
  test("kind filter passes through to the repository", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.list({ kind: "person" });

    expect(repository.list).toHaveBeenCalledWith({ kind: "person" });
  });

  test("ownerUnitId filter passes through to the repository", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.list({ ownerUnitId: "user-1" });

    expect(repository.list).toHaveBeenCalledWith({ ownerUnitId: "user-1" });
  });
});

describe("EntityService.getBySlug", () => {
  test("returns null when no Unit carries the slug", async () => {
    const service = await createService(
      createRepositoryStub({ getBySlug: mock(async () => null) }),
    );

    const row = await service.getBySlug("missing");
    expect(row).toBeNull();
  });

  test("passes entity slug scope to the repository", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.getBySlug("alice");
    expect(repository.getBySlug).toHaveBeenCalledWith({
      entityScope: "entity-scope-unit-id",
      slug: "alice",
    });
  });
});
