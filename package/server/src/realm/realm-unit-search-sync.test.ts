import { beforeEach, describe, expect, mock, test } from "bun:test";

const realmUnitInsertMock = mock(() => ({
  values: mock(() => ({
    returning: mock(async () => [
      {
        realmUnitId: "realm-1",
        unitId: "post-1",
        moderationStatus: "APPROVED",
        isLocked: false,
        createdAt: new Date("2026-05-28T00:00:00.000Z"),
      },
    ]),
  })),
}));
const realmUnitDeleteMock = mock(() => ({
  where: mock(async () => ({})),
}));
const enqueueMock = mock(async (_command: any) => ({ status: "created" }));

mock.module("../db/client", () => ({
  db: {
    insert: realmUnitInsertMock,
    delete: realmUnitDeleteMock,
  },
}));

mock.module("@/content-doc/json-write", () => ({
  nullableContentDocJson: (value: unknown) => value ?? null,
}));

mock.module("@/governance/action/realm", () => ({
  realmPolicyActions: new Proxy({}, { get: (_target, key) => key }),
}));

mock.module("@/governance/audit.service", () => ({
  governanceAuditService: {},
}));

mock.module("@/governance/capability.service", () => ({
  governanceCapabilityService: {
    realmMembershipForPolicy: async () => null,
  },
}));

mock.module("@/governance/moderation-action.service", () => ({
  moderationActionService: {},
}));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

mock.module("@/notify-boundary/notify-boundary.client", () => ({
  broadcast: mock(async () => undefined),
  filterRecipientsByPreference: mock(async (recipients: unknown) => recipients),
  notifySystemAndEmail: mock(async () => ({ ok: true })),
  resolveRecipients: mock(
    async (event: { directRecipients?: string[] }) =>
      event.directRecipients ?? [],
  ),
  sendDm: mock(async () => ({ ok: true })),
}));

mock.module("@/post/post.mapper", () => ({
  mapPostToDTO: (value: unknown) => value,
}));

mock.module("@/post/post.service", () => ({
  postService: {},
}));

mock.module("@/unit/language-resolution", () => ({
  resolveEffectiveReadLanguageCandidates: () => ["en"],
}));

mock.module("@/unit/mapper", () => ({
  mapTranslationToDTO: (value: unknown) => value,
}));

mock.module("@/utils/sanitizeUser", () => ({
  mapPublicUser: (user: unknown) => user ?? null,
}));

mock.module("@/utils/userSlugHydration", () => ({
  hydrateUnitOwnerUserSlugRow: (row: unknown) => row,
  hydrateUnitOwnerUserSlugs: (rows: unknown) => rows,
  loadUserSlugMap: async () => new Map(),
}));

mock.module("./realm-extra.service", () => ({
  appendToList: (value: unknown) => value,
  clearSingleExtraKey: (value: unknown) => value,
  filterRealmExtraPublic: (value: unknown) => value,
  readListAdmin: () => [],
  readListPublic: () => [],
  removeFromList: (value: unknown) => value,
  reorderList: (value: unknown) => value,
  setSingleExtraKey: (value: unknown) => value,
}));

const { RealmService } = await import(
  "./realm.service.ts?realm-unit-search-sync-test-actual" as string
);

describe("UnitRealm post search sync", () => {
  const service = new RealmService();

  beforeEach(() => {
    realmUnitInsertMock.mockClear();
    realmUnitDeleteMock.mockClear();
    enqueueMock.mockClear();
  });

  test("adding a UnitRealm patches the post realmIds field", async () => {
    await service.addUnitRealm("realm-1", "post-1");

    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.patchRealmIds",
      "search.post.sync",
    ]);
  });

  test("removing a UnitRealm patches the post realmIds field", async () => {
    await service.removeUnitRealm("realm-1", "post-1");

    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.patchRealmIds",
      "search.post.sync",
    ]);
  });
});
