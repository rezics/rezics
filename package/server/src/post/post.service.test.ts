import { describe, expect, mock, test } from "bun:test";
import {
  collectEditorialPatchLeafPaths,
  isEditorialPathInScope,
  markdownContentDoc,
} from "@rezics/contract";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const unitCreateMock = mock(async (): Promise<any> => ({ id: "post-1" }));
const unitFindUniqueMock = mock(async (): Promise<any> => null);
const unitFindUniqueOrThrowMock = mock(
  async (): Promise<any> => ({ id: "post-1", userId: "wiki-owner" }),
);
const unitFindManyMock = mock(
  async (args: any): Promise<any> =>
    (args.where.id.in as string[]).map((id) => ({ id })),
);
const postCreateMock = mock(
  async (_args?: any): Promise<any> => ({ unitId: "post-1" }),
);
const postUpdateMock = mock(
  async (_args?: any): Promise<any> => ({ unitId: "post-1" }),
);
const postFindManyMock = mock(async (): Promise<any[]> => []);
const postCountMock = mock(async () => 0);
const postFindUniqueMock = mock(async (): Promise<any> => null);
const postFindUniqueOrThrowMock = mock(
  async (): Promise<any> => ({
    unitId: "parent-1",
    rootPostUnitId: "root-1",
    depth: 0,
    isLocked: false,
    rootTargetUnitId: null,
    rootTargetUnitType: null,
    unit: {
      inRealms: [],
      realmModerationTargets: [],
    },
  }),
);
const postFindFirstMock = mock(async () => null);
const realmFindManyMock = mock(
  async (args: any): Promise<any[]> =>
    (args.where.unitId.in as string[]).map((unitId) => ({
      unitId,
      extra: {},
      ruleVersion: 1,
      ruleRequireOnPost: false,
    })),
);
const realmFindUniqueMock = mock(
  async (): Promise<any> => ({
    isPublic: true,
    unit: { userId: "owner-1" },
    members: [],
  }),
);
const realmMemberFindManyMock = mock(async (): Promise<any[]> => []);
const realmRuleAcknowledgementFindManyMock = mock(
  async (): Promise<any[]> => [],
);
const realmUnitCreateMock = mock(async (args: any) => {
  if (args.data.realmUnitId === "missing-realm") {
    throw new Error("Foreign key failed");
  }
  return args.data;
});
const unitWorkFindManyMock = mock(async (): Promise<any[]> => []);
const unitWorkUpsertMock = mock(async (args: any) => args.create);
const unitTagCreateMock = mock(async (args: any) => args.data);
const unitTagFindManyMock = mock(async (): Promise<any[]> => []);
const unitTranslationFindManyMock = mock(async (): Promise<any[]> => []);
const bookFindUniqueMock = mock(async (): Promise<any> => null);
const entityFindUniqueMock = mock(async (): Promise<any> => null);
const creditAttributionFindManyMock = mock(async (): Promise<any[]> => []);
const subjectAttributionFindManyMock = mock(async (): Promise<any[]> => []);
const unitCollaboratorFindUniqueMock = mock(async (): Promise<any> => null);
const unitFieldLockFindManyMock = mock(async (): Promise<any[]> => []);
const queryRawMock = mock(async (): Promise<any[]> => [{ sequence: 1n }]);
const executeRawMock = mock(async (): Promise<number> => 1);
const postPinCreateMock = mock(async (args: any) => ({
  ...args.data,
  createdAt: new Date("2026-05-29T00:00:00.000Z"),
}));
const postPinFindUniqueMock = mock(async (): Promise<any> => null);
const postPinFindFirstMock = mock(async (): Promise<any> => null);
const postPinDeleteMock = mock(async (args: any) => args.where);
const postPinCountMock = mock(async (): Promise<number> => 0);
const unitFindFirstMock = mock(async (): Promise<any> => null);
const realmMemberFindFirstMock = mock(async (): Promise<any> => null);
const unitTagFindUniqueMock = mock(async (): Promise<any> => null);
const historyOutboxCreateMock = mock(async (args: any) => args.data);
const userFindUniqueMock = mock(async () => null);
const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
const assertCanEditCollaborativeMetadataMock = mock(async () => undefined);
const collectPatchLeafPathsMock = mock(() => []);
const writeEditorialMetadataHistoryMock = mock(async () => undefined);
const blockedUserIdsMock = mock(async (): Promise<string[]> => []);
const transactionMock = mock(async (fn: any) =>
  fn({
    $queryRaw: queryRawMock,
    $executeRaw: executeRawMock,
    unit: {
      create: unitCreateMock,
      findMany: unitFindManyMock,
      findUniqueOrThrow: unitFindUniqueOrThrowMock,
    },
    post: {
      create: postCreateMock,
      update: postUpdateMock,
      findUniqueOrThrow: postFindUniqueOrThrowMock,
      findFirst: postFindFirstMock,
    },
    realm: { findMany: realmFindManyMock, findUnique: realmFindUniqueMock },
    realmMember: { findMany: realmMemberFindManyMock },
    realmRuleAcknowledgement: {
      findMany: realmRuleAcknowledgementFindManyMock,
    },
    unitRealm: { create: realmUnitCreateMock },
    unitWork: { findMany: unitWorkFindManyMock, upsert: unitWorkUpsertMock },
    unitTag: { create: unitTagCreateMock, findMany: unitTagFindManyMock },
    unitTranslation: { findMany: unitTranslationFindManyMock },
    book: { findUnique: bookFindUniqueMock },
    entity: { findUnique: entityFindUniqueMock },
    creditAttribution: { findMany: creditAttributionFindManyMock },
    subjectAttribution: { findMany: subjectAttributionFindManyMock },
    unitCollaborator: { findUnique: unitCollaboratorFindUniqueMock },
    unitFieldLock: { findMany: unitFieldLockFindManyMock },
    historyOutbox: { create: historyOutboxCreateMock },
  }),
);

installPrismaClientMock();
Object.assign(prismaMock, {
  $transaction: transactionMock,
  $queryRaw: queryRawMock,
  $executeRaw: executeRawMock,
  unit: {
    create: unitCreateMock,
    findMany: unitFindManyMock,
    findUnique: unitFindUniqueMock,
    findFirst: unitFindFirstMock,
    findUniqueOrThrow: unitFindUniqueOrThrowMock,
  },
  post: {
    create: postCreateMock,
    update: postUpdateMock,
    findMany: postFindManyMock,
    count: postCountMock,
    findUnique: postFindUniqueMock,
    findUniqueOrThrow: postFindUniqueOrThrowMock,
    findFirst: postFindFirstMock,
  },
  unitRealm: { create: realmUnitCreateMock },
  realm: { findMany: realmFindManyMock, findUnique: realmFindUniqueMock },
  realmMember: {
    findMany: realmMemberFindManyMock,
    findFirst: realmMemberFindFirstMock,
  },
  realmRuleAcknowledgement: {
    findMany: realmRuleAcknowledgementFindManyMock,
  },
  unitWork: { findMany: unitWorkFindManyMock, upsert: unitWorkUpsertMock },
  unitTag: {
    create: unitTagCreateMock,
    findMany: unitTagFindManyMock,
    findUnique: unitTagFindUniqueMock,
  },
  postPin: {
    create: postPinCreateMock,
    findUnique: postPinFindUniqueMock,
    findFirst: postPinFindFirstMock,
    delete: postPinDeleteMock,
    count: postPinCountMock,
  },
  user: { findUnique: userFindUniqueMock },
});

mock.module("@/infra/infra-users", () => ({
  resolveRezicsWikiUserId: mock(async () => "wiki-owner"),
}));

mock.module("@/block/block.service", () => ({
  blockService: {
    blockedUserIds: blockedUserIdsMock,
  },
}));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

mock.module("@/unit/collaborative-metadata", () => ({
  assertCanEditCollaborativeMetadata: assertCanEditCollaborativeMetadataMock,
  collectPatchLeafPaths: collectPatchLeafPathsMock,
  writeEditorialMetadataHistory: writeEditorialMetadataHistoryMock,
}));

mock.module("@/unit/publication-policy", () => ({
  publicUnitEligibilityWhere: { status: "PUBLISHED", visibility: "PUBLIC" },
  resolveStoredLicenseSlug: (slug: unknown) => slug ?? null,
}));

mock.module("@/utils/userSlugHydration", () => ({
  hydrateUnitOwnerUserSlugRow: mock((row: unknown) => row),
  hydrateUnitOwnerUserSlugs: mock((rows: unknown) => rows),
}));

mock.module("@/meili/post/sync", () => ({
  deletePostFromMeili: mock(async () => undefined),
  patchPostFieldsToMeili: mock(async () => undefined),
  patchPostsAuthorToMeili: mock(async () => undefined),
  patchPostsTargetToMeili: mock(async () => undefined),
  syncAllPostsToMeili: mock(async () => undefined),
  syncPostToMeili: mock(async () => undefined),
  syncPostsByAuthorToMeili: mock(async () => undefined),
  syncPostsByTargetToMeili: mock(async () => undefined),
}));

mock.module("@/meili/content/sync", () => ({
  deleteContentFromMeili: mock(async () => undefined),
  patchContentContainedUnitIdsToMeili: mock(async () => undefined),
  patchContentCreditsToMeili: mock(async () => undefined),
  patchContentMetadataToMeili: mock(async () => undefined),
  patchContentRealmIdsToMeili: mock(async () => undefined),
  patchContentRealmTagKeysToMeili: mock(async () => undefined),
  patchContentSubjectsToMeili: mock(async () => undefined),
  patchContentTagsToMeili: mock(async () => undefined),
  patchContentTranslationsToMeili: mock(async () => undefined),
  syncContentToMeili: mock(async () => undefined),
}));

mock.module("@/utils/sanitizeUser", () => ({
  mapPublicUser: mock((user: unknown) => user),
  publicUserSelect: {},
}));

const { PostService } = await import("./post.service");

const content = (source: string) => markdownContentDoc(source);

function resetMocks() {
  unitCreateMock.mockClear();
  unitFindUniqueMock.mockClear();
  unitFindUniqueOrThrowMock.mockClear();
  unitFindManyMock.mockClear();
  unitFindManyMock.mockImplementation(async (args: any) =>
    (args.where.id.in as string[]).map((id) => ({ id })),
  );
  postCreateMock.mockClear();
  postUpdateMock.mockClear();
  postFindManyMock.mockClear();
  postCountMock.mockClear();
  postFindUniqueMock.mockClear();
  postFindUniqueOrThrowMock.mockClear();
  postFindFirstMock.mockClear();
  realmFindManyMock.mockClear();
  realmFindManyMock.mockImplementation(async (args: any) =>
    (args.where.unitId.in as string[]).map((unitId) => ({
      unitId,
      extra: {},
      ruleVersion: 1,
      ruleRequireOnPost: false,
    })),
  );
  realmFindUniqueMock.mockClear();
  realmFindUniqueMock.mockResolvedValue({
    isPublic: true,
    unit: { userId: "owner-1" },
    members: [],
  });
  realmMemberFindManyMock.mockClear();
  realmMemberFindManyMock.mockResolvedValue([]);
  realmRuleAcknowledgementFindManyMock.mockClear();
  realmRuleAcknowledgementFindManyMock.mockResolvedValue([]);
  realmUnitCreateMock.mockClear();
  unitWorkFindManyMock.mockClear();
  unitWorkFindManyMock.mockResolvedValue([]);
  unitWorkUpsertMock.mockClear();
  unitTagCreateMock.mockClear();
  unitTagFindManyMock.mockClear();
  unitTranslationFindManyMock.mockClear();
  bookFindUniqueMock.mockClear();
  entityFindUniqueMock.mockClear();
  creditAttributionFindManyMock.mockClear();
  subjectAttributionFindManyMock.mockClear();
  unitCollaboratorFindUniqueMock.mockClear();
  unitFieldLockFindManyMock.mockClear();
  queryRawMock.mockClear();
  queryRawMock.mockImplementation(async () => [{ sequence: 1n }]);
  executeRawMock.mockClear();
  postPinCreateMock.mockClear();
  postPinFindUniqueMock.mockClear();
  postPinFindUniqueMock.mockResolvedValue(null);
  postPinFindFirstMock.mockClear();
  postPinFindFirstMock.mockResolvedValue(null);
  postPinDeleteMock.mockClear();
  postPinCountMock.mockClear();
  postPinCountMock.mockResolvedValue(0);
  unitFindFirstMock.mockClear();
  unitFindFirstMock.mockResolvedValue(null);
  realmMemberFindFirstMock.mockClear();
  realmMemberFindFirstMock.mockResolvedValue(null);
  unitTagFindUniqueMock.mockClear();
  unitTagFindUniqueMock.mockResolvedValue(null);
  historyOutboxCreateMock.mockClear();
  userFindUniqueMock.mockClear();
  enqueueMock.mockClear();
  assertCanEditCollaborativeMetadataMock.mockClear();
  collectPatchLeafPathsMock.mockClear();
  writeEditorialMetadataHistoryMock.mockClear();
  blockedUserIdsMock.mockClear();
  blockedUserIdsMock.mockResolvedValue([]);
  transactionMock.mockClear();
}

function firstPostFindManyArgs() {
  return (postFindManyMock.mock.calls as any[])[0]?.[0] as any;
}

describe("PostService.create realm/tag junction writes", () => {
  const service = new PostService();

  test("creates a post with no realm or tags", async () => {
    resetMocks();

    await service.create({ content: content("hello") }, "user-1");

    expect(realmUnitCreateMock).not.toHaveBeenCalled();
    expect(unitTagCreateMock).not.toHaveBeenCalled();
    expect(historyOutboxCreateMock).not.toHaveBeenCalled();
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.post.sync",
      "search.content.sync",
    ]);
  });

  test("creates UnitRealm rows for one realm", async () => {
    resetMocks();

    await service.create(
      { content: content("hello"), realmUnitIds: ["realm-1"] },
      "user-1",
    );

    expect(realmUnitCreateMock).toHaveBeenCalledTimes(1);
    expect(realmUnitCreateMock.mock.calls[0]?.[0].data).toMatchObject({
      realmUnitId: "realm-1",
      unitId: "post-1",
    });
  });

  test("realm-scoped wiki references do not add UnitRealm rows to the original wiki Unit", async () => {
    resetMocks();
    unitFindUniqueMock.mockResolvedValueOnce({ type: "POST" });

    await service.create(
      {
        content: content("see the wiki page"),
        targetUnitId: "wiki-original-1",
        realmUnitIds: ["realm-1"],
      },
      "user-1",
    );

    expect(realmUnitCreateMock).toHaveBeenCalledTimes(1);
    expect(realmUnitCreateMock.mock.calls[0]?.[0].data).toMatchObject({
      realmUnitId: "realm-1",
      unitId: "post-1",
    });
    expect(
      realmUnitCreateMock.mock.calls.some(
        (call) => call[0].data.unitId === "wiki-original-1",
      ),
    ).toBe(false);
  });

  test("creates UnitRealm rows for three realms", async () => {
    resetMocks();

    await service.create(
      {
        content: content("hello"),
        realmUnitIds: ["realm-1", "realm-2", "realm-3"],
      },
      "user-1",
    );

    expect(
      realmUnitCreateMock.mock.calls.map((call) => call[0].data.realmUnitId),
    ).toEqual(["realm-1", "realm-2", "realm-3"]);
  });

  test("creates UnitTag rows for tags", async () => {
    resetMocks();

    await service.create(
      { content: content("hello"), tagIds: ["tag-1", "tag-2"] },
      "user-1",
    );

    expect(unitFindManyMock).toHaveBeenCalledWith({
      where: {
        id: { in: ["tag-1", "tag-2"] },
        type: "TAG",
        status: { not: "DELETED" },
      },
      select: { id: true, slug: true },
    });
    expect(unitTagCreateMock.mock.calls.map((call) => call[0].data)).toEqual([
      { unitId: "post-1", tagUnitId: "tag-1" },
      { unitId: "post-1", tagUnitId: "tag-2" },
    ]);
  });

  test("creates UnitRealm and UnitTag rows in the same transaction", async () => {
    resetMocks();

    await service.create(
      {
        content: content("hello"),
        realmUnitIds: ["realm-1"],
        tagIds: ["tag-1"],
      },
      "user-1",
    );

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(realmUnitCreateMock).toHaveBeenCalledTimes(1);
    expect(unitTagCreateMock).toHaveBeenCalledTimes(1);
  });

  test("blocks realm post creation until required rules are acknowledged", async () => {
    resetMocks();
    realmFindManyMock.mockResolvedValueOnce([
      {
        unitId: "realm-1",
        extra: { rule: "rule-unit-1" },
        ruleVersion: 2,
        ruleRequireOnPost: true,
      },
    ]);

    await expect(
      service.create(
        { content: content("hello"), realmUnitIds: ["realm-1"] },
        "user-1",
      ),
    ).rejects.toThrow("Realm rules must be acknowledged before posting");
    expect(transactionMock).not.toHaveBeenCalled();
    expect(realmUnitCreateMock).not.toHaveBeenCalled();
  });

  test("allows realm post creation after required rule acknowledgement", async () => {
    resetMocks();
    realmFindManyMock.mockResolvedValueOnce([
      {
        unitId: "realm-1",
        extra: { rule: "rule-unit-1" },
        ruleVersion: 2,
        ruleRequireOnPost: true,
      },
    ]);
    realmRuleAcknowledgementFindManyMock.mockResolvedValueOnce([
      {
        realmUnitId: "realm-1",
        ruleUnitId: "rule-unit-1",
        version: 2,
      },
    ]);

    await service.create(
      { content: content("hello"), realmUnitIds: ["realm-1"] },
      "user-1",
    );

    expect(realmUnitCreateMock).toHaveBeenCalledTimes(1);
  });

  test("blocks realm post creation for restricted member states", async () => {
    resetMocks();
    realmMemberFindManyMock.mockResolvedValueOnce([
      { realmUnitId: "realm-1", state: "MUTED" },
    ]);

    await expect(
      service.create(
        { content: content("hello"), realmUnitIds: ["realm-1"] },
        "user-1",
      ),
    ).rejects.toThrow("Cannot post to realm while membership state is muted");
    expect(transactionMock).not.toHaveBeenCalled();
  });

  test("inherits parent realm rows for replies", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "parent-1",
      rootPostUnitId: "parent-1",
      depth: 0,
      isLocked: false,
      rootTargetUnitId: null,
      rootTargetUnitType: null,
      unit: {
        inRealms: [{ realmUnitId: "realm-1", state: "VISIBLE" }],
        realmModerationTargets: [],
      },
    });

    await service.create(
      { content: content("reply"), parentPostUnitId: "parent-1" },
      "user-1",
    );

    expect(realmUnitCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          realmUnitId: "realm-1",
          unitId: "post-1",
        }),
      }),
    );
  });

  test("blocks realm replies until required rules are acknowledged", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "parent-1",
      rootPostUnitId: "parent-1",
      depth: 0,
      isLocked: false,
      rootTargetUnitId: null,
      rootTargetUnitType: null,
      unit: {
        inRealms: [{ realmUnitId: "realm-1", state: "VISIBLE" }],
        realmModerationTargets: [],
      },
    });
    realmFindManyMock.mockResolvedValueOnce([
      {
        unitId: "realm-1",
        extra: { rule: "rule-unit-1" },
        ruleVersion: 2,
        ruleRequireOnPost: true,
      },
    ]);

    await expect(
      service.create(
        { content: content("reply"), parentPostUnitId: "parent-1" },
        "user-1",
      ),
    ).rejects.toThrow("Realm rules must be acknowledged before posting");
    expect(transactionMock).not.toHaveBeenCalled();
  });

  test("blocks replies to locked realm content", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "parent-1",
      rootPostUnitId: "parent-1",
      depth: 0,
      isLocked: false,
      rootTargetUnitId: null,
      rootTargetUnitType: null,
      unit: {
        inRealms: [{ realmUnitId: "realm-1", state: "VISIBLE" }],
        realmModerationTargets: [{ realmUnitId: "realm-1", state: "LOCKED" }],
      },
    });

    await expect(
      service.create(
        { content: content("reply"), parentPostUnitId: "parent-1" },
        "user-1",
      ),
    ).rejects.toThrow("Cannot reply to locked realm content");
    expect(transactionMock).not.toHaveBeenCalled();
  });

  test("registers review posts in target release work domains", async () => {
    resetMocks();
    unitWorkFindManyMock.mockResolvedValueOnce([{ workUnitId: "work-1" }]);

    await service.create(
      {
        content: content("review"),
        targetUnitId: "release-1",
        kind: "REVIEW",
      },
      "user-1",
    );

    expect(unitWorkFindManyMock).toHaveBeenCalledWith({
      where: {
        unitId: "release-1",
        role: "RELEASE",
      },
      select: { workUnitId: true },
      distinct: ["workUnitId"],
    });
    expect(unitWorkUpsertMock).toHaveBeenCalledWith({
      where: {
        unitId_workUnitId_role: {
          unitId: "post-1",
          workUnitId: "work-1",
          role: "REVIEW",
        },
      },
      update: {},
      create: {
        unitId: "post-1",
        workUnitId: "work-1",
        role: "REVIEW",
        displayPolicy: "PRIMARY",
      },
    });
  });

  test("does not register UnitWork rows for standalone targets", async () => {
    resetMocks();
    unitWorkFindManyMock.mockResolvedValueOnce([]);

    await service.create(
      { content: content("remark"), targetUnitId: "standalone-1" },
      "user-1",
    );

    expect(unitWorkFindManyMock).toHaveBeenCalledTimes(1);
    expect(unitWorkUpsertMock).not.toHaveBeenCalled();
  });

  test("rejects invalid tag ids with 400", async () => {
    resetMocks();
    unitFindManyMock.mockResolvedValueOnce([{ id: "tag-1" }]);

    await expect(
      service.create(
        { content: content("hello"), tagIds: ["tag-1", "missing-tag"] },
        "user-1",
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid tagIds: missing-tag",
    });
    expect(unitTagCreateMock).not.toHaveBeenCalled();
  });

  test("rejects when a realm insert fails", async () => {
    resetMocks();

    await expect(
      service.create(
        {
          content: content("hello"),
          realmUnitIds: ["realm-1", "missing-realm"],
        },
        "user-1",
      ),
    ).rejects.toThrow("Foreign key failed");
  });
});

describe("PostService.byRealm", () => {
  const service = new PostService();

  test("filters through UnitRealm and returns empty result", async () => {
    resetMocks();
    postFindManyMock.mockResolvedValueOnce([]);
    postCountMock.mockResolvedValueOnce(0);

    const result = await service.byRealm("realm-1");

    expect(result).toEqual({ posts: [], total: 0 });
    expect(firstPostFindManyArgs().where.unit.inRealms).toEqual({
      some: { realmUnitId: "realm-1", state: "VISIBLE" },
    });
    expect(firstPostFindManyArgs().where.unit.realmModerationTargets).toEqual({
      none: {
        realmUnitId: "realm-1",
        state: { in: ["HIDDEN", "TOMBSTONED", "ARCHIVED", "REMOVED"] },
      },
    });
  });

  test("regular callers cannot read private realm feeds without membership", async () => {
    resetMocks();
    realmFindUniqueMock.mockResolvedValueOnce({
      isPublic: false,
      unit: { userId: "owner-1" },
      members: [],
    });

    const result = await service.byRealm("realm-1");

    expect(result).toEqual({ posts: [], total: 0 });
    expect(postFindManyMock).not.toHaveBeenCalled();
    expect(postCountMock).not.toHaveBeenCalled();
  });

  test("active members can read private realm feeds", async () => {
    resetMocks();
    realmFindUniqueMock.mockResolvedValueOnce({
      isPublic: false,
      unit: { userId: "owner-1" },
      members: [{ state: "ACTIVE" }],
    });

    await service.byRealm("realm-1", {}, { viewerUserId: "member-1" });

    expect(postFindManyMock).toHaveBeenCalledTimes(1);
    expect(realmFindUniqueMock).toHaveBeenCalledWith({
      where: { unitId: "realm-1" },
      select: {
        isPublic: true,
        unit: { select: { userId: true } },
        members: {
          where: { userId: "member-1" },
          select: { state: true },
          take: 1,
        },
      },
    });
  });

  test("pending members only get the private realm preview shell", async () => {
    resetMocks();
    realmFindUniqueMock.mockResolvedValueOnce({
      isPublic: false,
      unit: { userId: "owner-1" },
      members: [{ state: "PENDING" }],
    });

    const result = await service.byRealm(
      "realm-1",
      {},
      { viewerUserId: "member-1" },
    );

    expect(result).toEqual({ posts: [], total: 0 });
    expect(postFindManyMock).not.toHaveBeenCalled();
  });

  test("admin realm feed can include non-visible lifecycle states", async () => {
    resetMocks();

    await service.byRealm("realm-1", {}, { isAdmin: true });

    expect(firstPostFindManyArgs().where.unit.inRealms).toEqual({
      some: { realmUnitId: "realm-1" },
    });
    expect(
      firstPostFindManyArgs().where.unit.realmModerationTargets,
    ).toBeUndefined();
  });

  test("admin realm feed can filter archived lifecycle overlays", async () => {
    resetMocks();

    await service.byRealm(
      "realm-1",
      { realmLifecycleState: "archived" },
      { isAdmin: true },
    );

    expect(firstPostFindManyArgs().where.unit.inRealms).toEqual({
      some: { realmUnitId: "realm-1" },
    });
    expect(firstPostFindManyArgs().where.unit.realmModerationTargets).toEqual({
      some: {
        realmUnitId: "realm-1",
        state: "ARCHIVED",
      },
    });
  });

  test("admin realm feed can filter visible lifecycle rows", async () => {
    resetMocks();

    await service.byRealm(
      "realm-1",
      { realmLifecycleState: "visible" },
      { isAdmin: true },
    );

    expect(firstPostFindManyArgs().where.unit.inRealms).toEqual({
      some: { realmUnitId: "realm-1", state: "VISIBLE" },
    });
    expect(
      firstPostFindManyArgs().where.unit.realmModerationTargets,
    ).toBeUndefined();
  });

  test("filters through UnitWork for work-domain feeds", async () => {
    resetMocks();

    await service.list({ workUnitId: "work-1", workRoles: ["REVIEW"] });

    expect(firstPostFindManyArgs().where.unit.workMemberships).toEqual({
      some: {
        workUnitId: "work-1",
        role: { in: ["REVIEW"] },
      },
    });
  });

  test("preserves targetUnitId as an exact-release filter with work domains", async () => {
    resetMocks();

    await service.list({
      targetUnitId: "release-1",
      workUnitId: "work-1",
      workRoles: ["POST", "REVIEW"],
    });

    const where = firstPostFindManyArgs().where;
    expect(where.targetUnitId).toBe("release-1");
    expect(where.unit.workMemberships).toEqual({
      some: {
        workUnitId: "work-1",
        role: { in: ["POST", "REVIEW"] },
      },
    });
  });

  test("hides blocked authors in general feeds", async () => {
    resetMocks();
    blockedUserIdsMock.mockResolvedValueOnce(["blocked-user-1"]);

    await service.list({}, { viewerUserId: "viewer-1" });

    expect(blockedUserIdsMock).toHaveBeenCalledWith("viewer-1");
    expect(firstPostFindManyArgs().where.AND).toEqual([
      { authorUserId: { notIn: ["blocked-user-1"] } },
    ]);
  });

  test("new sort orders by createdAt descending", async () => {
    resetMocks();
    await service.byRealm("realm-1", { sort: "new" });

    expect(firstPostFindManyArgs().orderBy).toEqual([{ createdAt: "desc" }]);
  });

  test("top sort orders by ScoreEntry value descending", async () => {
    resetMocks();
    await service.byRealm("realm-1", { sort: "top" });

    expect(firstPostFindManyArgs().orderBy).toEqual([
      { scoreEntry: { value: "desc" } },
      { createdAt: "desc" },
    ]);
  });

  test("hot sort applies seven-day window and top ordering", async () => {
    resetMocks();
    await service.byRealm("realm-1", { sort: "hot" });

    const args = firstPostFindManyArgs();
    expect(args.where.createdAt.gte).toBeInstanceOf(Date);
    expect(args.orderBy).toEqual([
      { scoreEntry: { value: "desc" } },
      { createdAt: "desc" },
    ]);
  });

  test("hides blocked authors in realm feeds", async () => {
    resetMocks();
    blockedUserIdsMock.mockResolvedValueOnce(["blocked-user-1"]);

    await service.byRealm("realm-1", {}, { viewerUserId: "viewer-1" });

    expect(blockedUserIdsMock).toHaveBeenCalledWith("viewer-1");
    expect(firstPostFindManyArgs().where.AND).toEqual([
      { authorUserId: { notIn: ["blocked-user-1"] } },
    ]);
  });

  test("tag filter uses RealmTagApplication OR UnitTag fallback semantics", async () => {
    resetMocks();
    await service.byRealm("realm-1", { tagIds: ["tag-1", "tag-2"] });

    expect(firstPostFindManyArgs().where.unit.OR).toEqual([
      {
        realmTagApplicationsAsTargetUnit: {
          some: {
            realmUnitId: "realm-1",
            tagUnitId: { in: ["tag-1", "tag-2"] },
          },
        },
      },
      {
        AND: [
          {
            realmTagApplicationsAsTargetUnit: {
              none: { realmUnitId: "realm-1" },
            },
          },
          {
            unitTags: {
              some: { tagUnitId: { in: ["tag-1", "tag-2"] } },
            },
          },
        ],
      },
    ]);
  });

  test("pagination passes start and limit through", async () => {
    resetMocks();
    await service.byRealm("realm-1", { start: 10, limit: 5 });

    const args = firstPostFindManyArgs();
    expect(args.skip).toBe(10);
    expect(args.take).toBe(5);
  });
});

describe("PostService.getPrimaryVisibleRealmForPost", () => {
  const service = new PostService();

  test("returns the first visible parent realm for route policy context", async () => {
    resetMocks();
    postFindUniqueMock.mockResolvedValueOnce({
      unit: {
        inRealms: [{ realmUnitId: "realm-1" }],
      },
    });

    await expect(
      service.getPrimaryVisibleRealmForPost("parent-post-1"),
    ).resolves.toBe("realm-1");
    expect(postFindUniqueMock).toHaveBeenCalledWith({
      where: { unitId: "parent-post-1" },
      select: {
        unit: {
          select: {
            inRealms: {
              where: { state: "VISIBLE" },
              select: { realmUnitId: true },
              take: 1,
            },
          },
        },
      },
    });
  });
});

describe("PostService.list subtree queries", () => {
  const service = new PostService();

  test("queries descendants by ltree containment scoped to the root thread", async () => {
    resetMocks();
    // First $queryRaw: anchor row (unitId/rootPostUnitId/depth/path).
    queryRawMock.mockImplementationOnce(async () => [
      {
        unitId: "reply-2",
        rootPostUnitId: "root-1",
        depth: 2,
        path: "0001.0002",
      },
    ]);
    // Second $queryRaw: descendant unitIds from `path <@ anchor.path`.
    queryRawMock.mockImplementationOnce(async () => [
      { unitId: "reply-3" },
      { unitId: "reply-4" },
    ]);

    await service.list({
      subtreeRootPostUnitId: "reply-2",
      mode: "threaded",
      maxDepth: 2,
    });

    // The whole-thread case is NOT used: retrieval is bounded by the
    // descendant id set computed from `path <@` and the thread root, ordered
    // by a DB key (School B), never by `path`.
    expect(firstPostFindManyArgs().where).toMatchObject({
      OR: [
        { unit: { status: "PUBLISHED", visibility: "PUBLIC" } },
        { unit: { status: "DELETED", visibility: "PUBLIC" } },
      ],
      rootPostUnitId: "root-1",
      unitId: { in: ["reply-3", "reply-4"] },
    });
    expect(firstPostFindManyArgs().where.path).toBeUndefined();
    expect(firstPostFindManyArgs().orderBy).toEqual([{ createdAt: "asc" }]);
  });

  test("intersects the descendant set with an explicit ids filter", async () => {
    resetMocks();
    queryRawMock.mockImplementationOnce(async () => [
      {
        unitId: "reply-2",
        rootPostUnitId: "root-1",
        depth: 1,
        path: "0001.0002",
      },
    ]);
    queryRawMock.mockImplementationOnce(async () => [
      { unitId: "reply-3" },
      { unitId: "reply-4" },
    ]);

    await service.list({
      subtreeRootPostUnitId: "reply-2",
      ids: "reply-4,reply-9",
    });

    expect(firstPostFindManyArgs().where).toMatchObject({
      rootPostUnitId: "root-1",
      unitId: { in: ["reply-4"] },
    });
  });

  test("missing anchor throws not-found", async () => {
    resetMocks();
    queryRawMock.mockImplementationOnce(async () => []);

    await expect(
      service.list({ subtreeRootPostUnitId: "missing-1" }),
    ).rejects.toThrow("Post not found: missing-1");
  });
});

describe("PostService.create rootTargetUnit derivation", () => {
  const service = new PostService();

  function createDataArg() {
    return (postCreateMock.mock.calls as any[])[0]?.[0]?.data as any;
  }

  test("top-level REVIEW carries its own targetUnitId as rootTargetUnitId with type from Unit", async () => {
    resetMocks();
    unitFindUniqueMock.mockResolvedValueOnce({ type: "BOOK" });

    await service.create(
      { content: content("great"), kind: "REVIEW", targetUnitId: "book-B" },
      "user-1",
    );

    expect(unitFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "book-B" },
      select: { type: true },
    });
    const data = createDataArg();
    expect(data.targetUnitId).toBe("book-B");
    expect(data.rootTargetUnitId).toBe("book-B");
    expect(data.rootTargetUnitType).toBe("BOOK");
  });

  test("top-level REMARK with game target derives GAME type", async () => {
    resetMocks();
    unitFindUniqueMock.mockResolvedValueOnce({ type: "GAME" });

    await service.create(
      { content: content("thoughts"), kind: "REMARK", targetUnitId: "game-G" },
      "user-1",
    );

    const data = createDataArg();
    expect(data.rootTargetUnitId).toBe("game-G");
    expect(data.rootTargetUnitType).toBe("GAME");
  });

  test("top-level POST with no targetUnitId leaves both fields undefined", async () => {
    resetMocks();

    await service.create({ content: content("free-form") }, "user-1");

    const data = createDataArg();
    expect(data.targetUnitId).toBeUndefined();
    expect(data.rootTargetUnitId).toBeUndefined();
    expect(data.rootTargetUnitType).toBeUndefined();
    // No Unit lookup needed when there is no target.
    expect(unitFindUniqueMock).not.toHaveBeenCalled();
  });

  test("reply inherits rootTargetUnit fields from parent without extra Unit lookup", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "parent-1",
      rootPostUnitId: "root-1",
      depth: 0,
      isLocked: false,
      rootTargetUnitId: "book-B",
      rootTargetUnitType: "BOOK",
      unit: {
        inRealms: [],
        realmModerationTargets: [],
      },
    });

    await service.create(
      { content: content("reply"), parentPostUnitId: "parent-1" },
      "user-1",
    );

    const data = createDataArg();
    expect(data.rootTargetUnitId).toBe("book-B");
    expect(data.rootTargetUnitType).toBe("BOOK");
    expect(unitFindUniqueMock).not.toHaveBeenCalled();
  });

  test("reply does not create independent UnitRealm placement rows", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "parent-1",
      rootPostUnitId: "root-1",
      depth: 0,
      isLocked: false,
      rootTargetUnitId: null,
      rootTargetUnitType: null,
      unit: {
        inRealms: [],
        realmModerationTargets: [],
      },
    });

    await service.create(
      {
        content: content("reply"),
        parentPostUnitId: "parent-1",
        realmUnitIds: ["realm-1"],
      },
      "user-1",
    );

    expect(realmUnitCreateMock).not.toHaveBeenCalled();
  });

  test("nested reply still inherits root target from its parent", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "comment-1",
      rootPostUnitId: "root-1",
      depth: 1,
      isLocked: false,
      rootTargetUnitId: "book-B",
      rootTargetUnitType: "BOOK",
      unit: {
        inRealms: [],
        realmModerationTargets: [],
      },
    });

    await service.create(
      { content: content("nested"), parentPostUnitId: "comment-1" },
      "user-1",
    );

    const data = createDataArg();
    expect(data.rootTargetUnitId).toBe("book-B");
    expect(data.rootTargetUnitType).toBe("BOOK");
  });

  test("CHAPTER kind reuses the Unit type read from the BOOK validation (single Unit lookup)", async () => {
    resetMocks();
    unitFindUniqueMock.mockResolvedValueOnce({ type: "BOOK" });

    await service.create(
      { content: content("ch1"), kind: "CHAPTER", targetUnitId: "book-B" },
      "user-1",
    );

    expect(unitFindUniqueMock).toHaveBeenCalledTimes(1);
    const data = createDataArg();
    expect(data.rootTargetUnitId).toBe("book-B");
    expect(data.rootTargetUnitType).toBe("BOOK");
  });
});

describe("PostService.update immutability", () => {
  const service = new PostService();

  test("update writes only content/isLocked/extra; rootTarget* fields are not in the update payload", async () => {
    resetMocks();
    const directPostUpdateMock = mock(async () => ({ unitId: "post-1" }));
    Object.assign(prismaMock.post, { update: directPostUpdateMock });

    await service.update("post-1", {
      content: content("edited"),
      isLocked: true,
    });

    expect(directPostUpdateMock).toHaveBeenCalledTimes(1);
    const args = (directPostUpdateMock.mock.calls as any[])[0]?.[0];
    expect(args.where).toEqual({ unitId: "post-1" });
    expect(args.data).toEqual({ content: content("edited"), isLocked: true });
    expect(args.data.targetUnitId).toBeUndefined();
    expect(args.data.rootTargetUnitId).toBeUndefined();
    expect(args.data.rootTargetUnitType).toBeUndefined();
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.post.patchFields",
      "search.content.sync",
    ]);

    // Restore the shared mock so subsequent tests see the standard behavior.
    Object.assign(prismaMock.post, { update: postUpdateMock });
  });
});

describe("PostService wiki posts", () => {
  const service = new PostService();
  const actor = {
    userId: "actor-1",
    permission: { role: "USER" },
  } as any;
  const rootActor = {
    userId: "root-1",
    permission: { role: "ROOT" },
  } as any;

  test("wiki creation uses rezics-wiki ownership and records author", async () => {
    resetMocks();
    postCreateMock.mockImplementationOnce(async (args: any) => ({
      unitId: "wiki-post-1",
      content: args.data.content,
      kind: args.data.kind,
    }));
    postUpdateMock.mockImplementationOnce(async (args: any) => ({
      unitId: "wiki-post-1",
      content: content("body"),
      kind: "WIKI",
      rootPostUnitId: args.data.rootPostUnitId,
    }));

    await service.create({ kind: "WIKI", content: content("body") }, "actor-1");

    const unitCreateArgs = (unitCreateMock.mock.calls as any[])[0][0];
    const postCreateArgs = (postCreateMock.mock.calls as any[])[0][0];
    expect(unitCreateArgs.data.userId).toBe("wiki-owner");
    expect(postCreateArgs.data.authorUserId).toBe("actor-1");
    expect(postCreateArgs.data.kind).toBe("WIKI");
    expect(writeEditorialMetadataHistoryMock).toHaveBeenCalledTimes(1);
    const patch = writeEditorialMetadataHistoryMock.mock.calls[0]?.[1].patch;
    expect(
      collectEditorialPatchLeafPaths(patch).every((path) =>
        isEditorialPathInScope("wiki-post", path),
      ),
    ).toBe(true);
  });

  test("unlocked wiki content edit writes through collaborative authority", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockImplementationOnce(async () => ({
      kind: "WIKI",
      content: content("original"),
    }));

    await service.update("wiki-post-1", { content: content("edited") }, actor);

    expect(assertCanEditCollaborativeMetadataMock).toHaveBeenCalledTimes(1);
    expect(postUpdateMock).toHaveBeenCalledTimes(1);
    expect(writeEditorialMetadataHistoryMock).toHaveBeenCalledTimes(1);
  });

  test("ROOT wiki content edit still routes through collaborative authority", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockImplementationOnce(async () => ({
      kind: "WIKI",
      content: content("original"),
    }));

    await service.update(
      "wiki-post-1",
      { content: content("edited") },
      rootActor,
    );

    expect(assertCanEditCollaborativeMetadataMock).toHaveBeenCalledWith(
      expect.anything(),
      rootActor,
      "wiki-post-1",
      ["post.content.main"],
    );
    expect(writeEditorialMetadataHistoryMock).toHaveBeenCalledTimes(1);
  });

  test("wiki content source patch uses path-based lock and history", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockImplementationOnce(async () => ({
      kind: "WIKI",
      content: content("original"),
    }));
    collectPatchLeafPathsMock.mockReturnValueOnce(["post.content.main.source"]);

    await service.update("wiki-post-1", { content: content("edited") }, actor, {
      patch: { post: { content: { main: { source: "edited" } } } },
      message: "wiki-post.content.source.update",
    });

    expect(assertCanEditCollaborativeMetadataMock).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      "wiki-post-1",
      ["post.content.main.source"],
    );
    expect(writeEditorialMetadataHistoryMock).toHaveBeenCalledTimes(1);
    expect(writeEditorialMetadataHistoryMock.mock.calls[0]?.[1]).toMatchObject({
      unitId: "wiki-post-1",
      actorUserId: "actor-1",
      patch: { post: { content: { main: { source: "edited" } } } },
      message: "wiki-post.content.source.update",
    });

    resetMocks();
    postFindUniqueOrThrowMock.mockImplementationOnce(async () => ({
      kind: "WIKI",
      content: content("original"),
    }));
    collectPatchLeafPathsMock.mockReturnValueOnce(["post.content.main.source"]);
    assertCanEditCollaborativeMetadataMock.mockRejectedValueOnce({
      statusCode: 403,
      code: "FIELD_LOCKED",
      details: {
        blockedPaths: ["post.content.main.source"],
        offendingLockPath: "post.content.main.source",
        offendingPatchPath: "post.content.main.source",
      },
    });

    await expect(
      service.update("wiki-post-1", { content: content("edited") }, actor, {
        patch: { post: { content: { main: { source: "edited" } } } },
        message: "wiki-post.content.source.update",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FIELD_LOCKED",
      details: {
        blockedPaths: ["post.content.main.source"],
        offendingLockPath: "post.content.main.source",
        offendingPatchPath: "post.content.main.source",
      },
    });
  });

  test("locked wiki content edit is rejected", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockImplementationOnce(async () => ({
      kind: "WIKI",
      content: content("original"),
    }));
    assertCanEditCollaborativeMetadataMock.mockRejectedValueOnce({
      statusCode: 403,
      code: "FIELD_LOCKED",
    });

    await expect(
      service.update("wiki-post-1", { content: content("edited") }, actor),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FIELD_LOCKED",
    });
    expect(postUpdateMock).not.toHaveBeenCalled();
  });

  test("ordinary review update does not query field locks", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockImplementationOnce(async () => ({
      kind: "REVIEW",
      content: content("original"),
    }));

    await service.update("review-1", { content: content("edited") }, actor);

    expect(unitFieldLockFindManyMock).not.toHaveBeenCalled();
    expect(historyOutboxCreateMock).not.toHaveBeenCalled();
  });

  test("Post.isLocked does not control wiki content locks", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockImplementationOnce(async () => ({
      kind: "WIKI",
      content: content("original"),
    }));

    await service.update(
      "wiki-post-1",
      { content: content("edited"), isLocked: true },
      actor,
    );

    expect(assertCanEditCollaborativeMetadataMock).toHaveBeenCalledTimes(1);
    const postUpdateArgs = (postUpdateMock.mock.calls as any[])[0][0];
    expect(postUpdateArgs.data.isLocked).toBe(true);
  });
});

describe("PostService promotion overlay (pin / accepted answer)", () => {
  const service = new PostService();
  const op = { userId: "op-1", permission: { role: "USER" } } as any;
  const stranger = {
    userId: "stranger-1",
    permission: { role: "USER" },
  } as any;

  const rootScope = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    authorUserId: "op-1",
    depth: 0,
    rootPostUnitId: "root-1",
    unit: { type: "POST", inRealms: [] },
    ...overrides,
  });
  const directReply = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    depth: 1,
    rootPostUnitId: "root-1",
    parentPostUnitId: "root-1",
    ...overrides,
  });

  test("OP pins a reply within their own thread", async () => {
    resetMocks();
    postFindUniqueMock
      .mockResolvedValueOnce(rootScope())
      .mockResolvedValueOnce(directReply());

    const pin = await service.pin(
      { scopeUnitId: "root-1", postUnitId: "reply-1" },
      op,
    );

    expect(postPinCreateMock.mock.calls[0][0].data).toMatchObject({
      scopeUnitId: "root-1",
      postUnitId: "reply-1",
      kind: "PINNED",
      byUserId: "op-1",
    });
    expect(pin.kind).toBe("PINNED");
  });

  test("a non-OP non-moderator cannot pin", async () => {
    resetMocks();
    postFindUniqueMock.mockResolvedValueOnce(
      rootScope({
        unit: { type: "POST", inRealms: [{ realmUnitId: "realm-1" }] },
      }),
    );

    await expect(
      service.pin({ scopeUnitId: "root-1", postUnitId: "reply-1" }, stranger),
    ).rejects.toThrow(/moderator\/owner/);
    expect(postPinCreateMock).not.toHaveBeenCalled();
  });

  test("a realm moderator may pin in a thread of their realm", async () => {
    resetMocks();
    postFindUniqueMock
      .mockResolvedValueOnce(
        rootScope({
          unit: { type: "POST", inRealms: [{ realmUnitId: "realm-1" }] },
        }),
      )
      .mockResolvedValueOnce(directReply());
    realmMemberFindFirstMock.mockResolvedValueOnce({ realmUnitId: "realm-1" });

    const pin = await service.pin(
      { scopeUnitId: "root-1", postUnitId: "reply-1" },
      { userId: "mod-1", permission: { role: "USER" } } as any,
    );
    expect(pin.kind).toBe("PINNED");
  });

  test("rejects a target outside the scope thread", async () => {
    resetMocks();
    postFindUniqueMock.mockResolvedValueOnce(rootScope()).mockResolvedValueOnce(
      directReply({
        rootPostUnitId: "other-root",
        parentPostUnitId: "other-root",
      }),
    );

    await expect(
      service.pin({ scopeUnitId: "root-1", postUnitId: "reply-x" }, op),
    ).rejects.toThrow(/scope thread/);
  });

  test("rejects a realm id as a scope", async () => {
    resetMocks();
    postFindUniqueMock.mockResolvedValueOnce(null);
    unitFindUniqueMock.mockResolvedValueOnce({ type: "REALM" });

    await expect(
      service.pin({ scopeUnitId: "realm-1", postUnitId: "reply-1" }, op),
    ).rejects.toThrow(/pinboard/);
  });

  test("accept is rejected outside a Q&A thread", async () => {
    resetMocks();
    postFindUniqueMock
      .mockResolvedValueOnce(rootScope())
      .mockResolvedValueOnce(directReply());
    unitFindFirstMock.mockResolvedValueOnce(null); // no official question tag

    await expect(
      service.acceptAnswer(
        { scopeUnitId: "root-1", postUnitId: "reply-1" },
        op,
      ),
    ).rejects.toThrow(/Q&A thread/);
    expect(postPinCreateMock).not.toHaveBeenCalled();
  });

  test("accept is rejected for a non-direct reply", async () => {
    resetMocks();
    postFindUniqueMock
      .mockResolvedValueOnce(rootScope())
      .mockResolvedValueOnce(
        directReply({ depth: 2, parentPostUnitId: "reply-1" }),
      );

    await expect(
      service.acceptAnswer(
        { scopeUnitId: "root-1", postUnitId: "reply-2" },
        op,
      ),
    ).rejects.toThrow(/direct reply/);
  });

  test("OP accepts a qualifying direct reply in a Q&A thread", async () => {
    resetMocks();
    postFindUniqueMock
      .mockResolvedValueOnce(rootScope())
      .mockResolvedValueOnce(directReply());
    unitFindFirstMock.mockResolvedValueOnce({ id: "tag-q" });
    unitTagFindUniqueMock.mockResolvedValueOnce({ unitId: "root-1" });

    const pin = await service.acceptAnswer(
      { scopeUnitId: "root-1", postUnitId: "reply-1" },
      op,
    );
    expect(pin.kind).toBe("ACCEPTED_ANSWER");
    expect(postPinCreateMock.mock.calls[0][0].data.kind).toBe(
      "ACCEPTED_ANSWER",
    );
  });

  test("multiple accepted answers get distinct positions without renumbering", async () => {
    resetMocks();
    unitFindFirstMock.mockResolvedValue({ id: "tag-q" });
    unitTagFindUniqueMock.mockResolvedValue({ unitId: "root-1" });

    postFindUniqueMock
      .mockResolvedValueOnce(rootScope())
      .mockResolvedValueOnce(directReply());
    await service.acceptAnswer(
      { scopeUnitId: "root-1", postUnitId: "reply-1" },
      op,
    );

    postFindUniqueMock
      .mockResolvedValueOnce(rootScope())
      .mockResolvedValueOnce(directReply({ parentPostUnitId: "root-1" }));
    postPinFindFirstMock.mockResolvedValueOnce({ position: "a0" });
    await service.acceptAnswer(
      { scopeUnitId: "root-1", postUnitId: "reply-2" },
      op,
    );

    expect(postPinCreateMock).toHaveBeenCalledTimes(2);
    const positions = (postPinCreateMock.mock.calls as any[]).map(
      (call) => call[0].data.position,
    );
    expect(positions[0]).not.toBe(positions[1]);
  });

  test("unpin removes the PINNED promotion after a capability check", async () => {
    resetMocks();
    postFindUniqueMock.mockResolvedValueOnce(rootScope());
    postPinFindUniqueMock.mockResolvedValueOnce({ kind: "PINNED" });

    await service.unpin("root-1", "reply-1", op);
    expect(postPinDeleteMock).toHaveBeenCalled();
  });

  test("unaccept rejects when the existing pin is not an accepted answer", async () => {
    resetMocks();
    postFindUniqueMock.mockResolvedValueOnce(rootScope());
    postPinFindUniqueMock.mockResolvedValueOnce({ kind: "PINNED" });

    await expect(
      service.unacceptAnswer("root-1", "reply-1", op),
    ).rejects.toThrow(/not found/);
    expect(postPinDeleteMock).not.toHaveBeenCalled();
  });
});

describe("PostService.getThreadPromotionSignals (thread read signals)", () => {
  const service = new PostService();
  const op = { userId: "op-1", permission: { role: "USER" } } as any;
  const stranger = {
    userId: "stranger-1",
    permission: { role: "USER" },
  } as any;
  const admin = { userId: "admin-1", permission: { role: "ADMIN" } } as any;

  const readScope = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    authorUserId: "op-1",
    depth: 0,
    rootPostUnitId: "root-1",
    unit: { inRealms: [] },
    ...overrides,
  });

  test("OP sees viewerCanPromote=true on their own thread", async () => {
    resetMocks();
    postFindUniqueMock.mockResolvedValueOnce(readScope());

    const signals = await service.getThreadPromotionSignals("root-1", op);
    expect(signals.viewerCanPromote).toBe(true);
  });

  test("an unrelated viewer sees viewerCanPromote=false", async () => {
    resetMocks();
    postFindUniqueMock.mockResolvedValueOnce(
      readScope({ unit: { inRealms: [{ realmUnitId: "realm-1" }] } }),
    );

    const signals = await service.getThreadPromotionSignals("root-1", stranger);
    expect(signals.viewerCanPromote).toBe(false);
  });

  test("an anonymous caller sees viewerCanPromote=false without a scope lookup", async () => {
    resetMocks();

    const signals = await service.getThreadPromotionSignals("root-1", null);
    expect(signals.viewerCanPromote).toBe(false);
    expect(postFindUniqueMock).not.toHaveBeenCalled();
  });

  test("a realm moderator sees viewerCanPromote=true", async () => {
    resetMocks();
    postFindUniqueMock.mockResolvedValueOnce(
      readScope({ unit: { inRealms: [{ realmUnitId: "realm-1" }] } }),
    );
    realmMemberFindFirstMock.mockResolvedValueOnce({ realmUnitId: "realm-1" });

    const signals = await service.getThreadPromotionSignals("root-1", {
      userId: "mod-1",
      permission: { role: "USER" },
    } as any);
    expect(signals.viewerCanPromote).toBe(true);
  });

  test("a realm owner sees viewerCanPromote=true", async () => {
    resetMocks();
    postFindUniqueMock.mockResolvedValueOnce(
      readScope({ unit: { inRealms: [{ realmUnitId: "realm-1" }] } }),
    );
    // First unit.findFirst is the question-tag lookup (none); second is the
    // owned-realm lookup (hit).
    unitFindFirstMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "realm-1" });

    const signals = await service.getThreadPromotionSignals("root-1", {
      userId: "owner-1",
      permission: { role: "USER" },
    } as any);
    expect(signals.viewerCanPromote).toBe(true);
  });

  test("a platform admin sees viewerCanPromote=true on someone else's thread", async () => {
    resetMocks();
    postFindUniqueMock.mockResolvedValueOnce(
      readScope({ authorUserId: "someone-else" }),
    );

    const signals = await service.getThreadPromotionSignals("root-1", admin);
    expect(signals.viewerCanPromote).toBe(true);
  });

  test("viewerCanPromote=false agrees with the write guard for the same caller", async () => {
    // Read path: stranger gets no capability.
    resetMocks();
    postFindUniqueMock.mockResolvedValueOnce(
      readScope({ unit: { inRealms: [{ realmUnitId: "realm-1" }] } }),
    );
    const read = await service.getThreadPromotionSignals("root-1", stranger);
    expect(read.viewerCanPromote).toBe(false);

    // Write guard: the same stranger is rejected when they attempt to pin.
    resetMocks();
    postFindUniqueMock.mockResolvedValueOnce(
      readScope({
        unit: { type: "POST", inRealms: [{ realmUnitId: "realm-1" }] },
      }),
    );
    await expect(
      service.pin({ scopeUnitId: "root-1", postUnitId: "reply-1" }, stranger),
    ).rejects.toThrow(/moderator\/owner/);
  });

  test("isQuestionThread=true when the root bears the official question tag", async () => {
    resetMocks();
    unitFindFirstMock.mockResolvedValueOnce({ id: "tag-q" });
    unitTagFindUniqueMock.mockResolvedValueOnce({ unitId: "root-1" });
    postFindUniqueMock.mockResolvedValueOnce(readScope());

    const signals = await service.getThreadPromotionSignals("root-1", op);
    expect(signals.isQuestionThread).toBe(true);
  });

  test("isQuestionThread=false when the root lacks the official question tag", async () => {
    resetMocks();
    unitFindFirstMock.mockResolvedValue(null);
    postFindUniqueMock.mockResolvedValueOnce(readScope());

    const signals = await service.getThreadPromotionSignals("root-1", op);
    expect(signals.isQuestionThread).toBe(false);
  });
});

describe("PostService lifecycle state", () => {
  const service = new PostService();
  const op = { userId: "op-1", permission: { role: "USER" } } as any;

  function createDataArg() {
    return (postCreateMock.mock.calls as any[])[0]?.[0]?.data as any;
  }

  const rootScope = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    authorUserId: "op-1",
    depth: 0,
    rootPostUnitId: "root-1",
    unit: { type: "POST", inRealms: [] },
    ...overrides,
  });
  const directReply = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    depth: 1,
    rootPostUnitId: "root-1",
    parentPostUnitId: "root-1",
    ...overrides,
  });

  // 5.1
  test("create with the question tag sets state=open and snapshots stateSchemaTag", async () => {
    resetMocks();
    unitFindManyMock.mockResolvedValue([{ id: "tag-q", slug: "question" }]);

    await service.create(
      { content: content("hi"), tagIds: ["tag-q"] },
      "user-1",
    );

    const data = createDataArg();
    expect(data.state).toBe("open");
    expect(data.extra).toMatchObject({ stateSchemaTag: "question" });
  });

  test("create without a stateful tag leaves state undefined", async () => {
    resetMocks();
    unitFindManyMock.mockResolvedValue([{ id: "tag-x", slug: "book" }]);

    await service.create(
      { content: content("hi"), tagIds: ["tag-x"] },
      "user-1",
    );

    expect(createDataArg().state).toBeUndefined();
  });

  // 5.2
  test("a second stateful tag is rejected", async () => {
    resetMocks();
    unitFindManyMock.mockResolvedValue([
      { id: "tag-q", slug: "question" },
      { id: "tag-i", slug: "issue" },
    ]);

    await expect(
      service.create(
        { content: content("hi"), tagIds: ["tag-q", "tag-i"] },
        "user-1",
      ),
    ).rejects.toThrow(/at most one stateful tag/);
  });

  // 5.2 — the snapshot is written only at creation; setState never rewrites it.
  test("setState changes only `state`, never the stateSchemaTag snapshot", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      state: "open",
      extra: { stateSchemaTag: "question" },
    });

    await service.setState("post-1", "solved");

    const args = (postUpdateMock.mock.calls as any[])[0]?.[0];
    expect(args.data).toEqual({ state: "solved" });
    expect("extra" in args.data).toBe(false);
  });

  // 5.3
  test("illegal state value is rejected on write", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      state: "open",
      extra: { stateSchemaTag: "question" },
    });

    await expect(service.setState("post-1", "banana")).rejects.toThrow(
      /Illegal state value/,
    );
    expect(postUpdateMock).not.toHaveBeenCalled();
  });

  test("disallowed transition is rejected on write", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      state: "solved",
      extra: { stateSchemaTag: "question" },
    });

    // solved → duplicate is a closed→closed jump the schema does not declare.
    await expect(service.setState("post-1", "duplicate")).rejects.toThrow(
      /Disallowed state transition/,
    );
    expect(postUpdateMock).not.toHaveBeenCalled();
  });

  test("setState on a post without a schema is rejected", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({ state: null, extra: {} });

    await expect(service.setState("post-1", "open")).rejects.toThrow(
      /no lifecycle state schema/,
    );
  });

  // 5.4
  test("accepting an answer advances open → solved", async () => {
    resetMocks();
    postFindUniqueMock
      .mockResolvedValueOnce(rootScope())
      .mockResolvedValueOnce(directReply())
      .mockResolvedValueOnce({
        state: "open",
        extra: { stateSchemaTag: "question" },
      });
    unitFindFirstMock.mockResolvedValueOnce({ id: "tag-q" });
    unitTagFindUniqueMock.mockResolvedValueOnce({ unitId: "root-1" });

    await service.acceptAnswer(
      { scopeUnitId: "root-1", postUnitId: "reply-1" },
      op,
    );

    expect(postUpdateMock).toHaveBeenCalledWith({
      where: { unitId: "root-1" },
      data: { state: "solved" },
    });
  });

  test("accepting an answer never overwrites a manual closed reason", async () => {
    resetMocks();
    postFindUniqueMock
      .mockResolvedValueOnce(rootScope())
      .mockResolvedValueOnce(directReply())
      .mockResolvedValueOnce({
        state: "duplicate",
        extra: { stateSchemaTag: "question" },
      });
    unitFindFirstMock.mockResolvedValueOnce({ id: "tag-q" });
    unitTagFindUniqueMock.mockResolvedValueOnce({ unitId: "root-1" });

    await service.acceptAnswer(
      { scopeUnitId: "root-1", postUnitId: "reply-1" },
      op,
    );

    expect(postUpdateMock).not.toHaveBeenCalled();
  });

  test("unaccepting the last answer reverts solved → open", async () => {
    resetMocks();
    postFindUniqueMock
      .mockResolvedValueOnce(rootScope())
      .mockResolvedValueOnce({
        state: "solved",
        extra: { stateSchemaTag: "question" },
      });
    postPinFindUniqueMock.mockResolvedValueOnce({ kind: "ACCEPTED_ANSWER" });
    postPinCountMock.mockResolvedValueOnce(0);

    await service.unacceptAnswer("root-1", "reply-1", op);

    expect(postUpdateMock).toHaveBeenCalledWith({
      where: { unitId: "root-1" },
      data: { state: "open" },
    });
  });

  test("unaccepting does not reopen while another accepted answer remains", async () => {
    resetMocks();
    postFindUniqueMock.mockResolvedValueOnce(rootScope());
    postPinFindUniqueMock.mockResolvedValueOnce({ kind: "ACCEPTED_ANSWER" });
    postPinCountMock.mockResolvedValueOnce(1);

    await service.unacceptAnswer("root-1", "reply-1", op);

    expect(postUpdateMock).not.toHaveBeenCalled();
  });

  // 5.5 — reply permission reads isLocked, never state (D4).
  test("the reply parent load reads isLocked, not state", async () => {
    resetMocks();

    await service.create(
      { content: content("reply"), parentPostUnitId: "parent-1" },
      "user-1",
    );

    const select = (postFindUniqueOrThrowMock.mock.calls as any[])[0]?.[0]
      ?.select;
    expect(select.isLocked).toBe(true);
    expect(select.state).toBeUndefined();
    expect(postCreateMock).toHaveBeenCalled();
  });

  // 5.6
  test("active bucket filter matches state IN the active slugs (no anti-join)", async () => {
    resetMocks();
    await service.list({ stateBucket: "active" });
    expect(firstPostFindManyArgs().where.state).toEqual({ in: ["open"] });
  });

  test("closed bucket filter matches all closed reason values", async () => {
    resetMocks();
    await service.list({ stateBucket: "closed" });
    const inList = (firstPostFindManyArgs().where.state.in as string[]).sort();
    expect(inList).toEqual(
      ["completed", "duplicate", "not-planned", "off-topic", "solved"].sort(),
    );
  });

  test("an exact state filter takes precedence over a bucket", async () => {
    resetMocks();
    await service.list({ state: "open", stateBucket: "closed" });
    expect(firstPostFindManyArgs().where.state).toBe("open");
  });

  // 5.7
  test("closing writes a reason value and reopening returns to the initial state", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      state: "open",
      extra: { stateSchemaTag: "question" },
    });
    await service.setState("post-1", "not-planned");
    expect((postUpdateMock.mock.calls as any[])[0]?.[0].data).toEqual({
      state: "not-planned",
    });

    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      state: "not-planned",
      extra: { stateSchemaTag: "question" },
    });
    await service.setState("post-1", "open");
    expect((postUpdateMock.mock.calls as any[])[0]?.[0].data).toEqual({
      state: "open",
    });
  });

  test("a bare `closed` value is rejected (closing requires a reason)", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      state: "open",
      extra: { stateSchemaTag: "question" },
    });
    await expect(service.setState("post-1", "closed")).rejects.toThrow(
      /Illegal state value/,
    );
  });
});
