import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  Realm,
  RealmMember,
  RealmRuleAcknowledgement,
  Subscription,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
  User,
  UserSubscriptionListEntry,
} from "../db/schema";

const legacyDbMock: Record<string, any> = {};

// Stub fire-and-forget meili sync so it doesn't reach into real env.
// 桩掉 fire-and-forget 的 meili 同步，避免触及真实环境变量。
const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
const appendToListMock = mock(async () => ({
  unitIds: ["unit-1", "unit-2"],
}));
const reorderListMock = mock(async (_caller, _realmId, _key, unitIds) => ({
  unitIds,
}));
const removeFromListMock = mock(async () => ({ unitIds: ["unit-2"] }));
const setSingleExtraKeyMock = mock(async () => undefined);
const clearSingleExtraKeyMock = mock(async () => undefined);
const auditPrivilegedMutationMock = mock(async () => ({ id: "audit-1" }));
const broadcastMock = mock(async (_event: any) => ({ ok: true }));
const appendModerationActionMock = mock(async (_tx: any, input: any) =>
  legacyDbMock.moderationAction?.create?.({ data: input }),
);
const postGetByUnitIdMock = mock(async (unitId: string) =>
  legacyDbMock.post?.findUnique?.({ where: { unitId } }),
);
mock.module("@/meili/realm/sync", () => ({
  patchRealmMemberCountToMeili: mock(async () => undefined),
  patchRealmMetadataToMeili: mock(async () => undefined),
  syncRealmToMeili: mock(async () => undefined),
}));
mock.module("@/meili/content/sync", () => ({
  patchContentRealmIdsToMeili: mock(async () => undefined),
  patchContentRealmTagKeysToMeili: mock(async () => undefined),
  patchContentTagsToMeili: mock(async () => undefined),
}));
mock.module("@/meili/post/sync", () => ({
  patchPostFieldsToMeili: mock(async () => undefined),
}));
mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));
mock.module("@/governance/audit.service", () => ({
  governanceAuditService: {
    appendPrivilegedMutation: auditPrivilegedMutationMock,
  },
}));
mock.module("@/content-doc/json-write", () => ({
  nullableContentDocJson: (value: unknown) => value ?? null,
}));
mock.module("@/governance/action/realm", () => ({
  realmPolicyActions: {
    contentPin: "content.pin",
    rulesUpdate: "realm.rules.update",
  },
}));
mock.module("@/notify-boundary/notify-boundary.client", () => ({
  broadcast: broadcastMock,
  filterRecipientsByPreference: mock(async (recipients: unknown) => recipients),
  notifySystemAndEmail: mock(async () => ({ ok: true })),
  resolveRecipients: mock(
    async (event: { directRecipients?: string[] }) =>
      event.directRecipients ?? [],
  ),
  sendDm: mock(async () => ({ ok: true })),
}));
mock.module("@/governance/moderation-action.service", () => ({
  moderationActionService: {
    appendModerationAction: appendModerationActionMock,
  },
}));
mock.module("@/post/post.service", () => ({
  postService: {
    getByUnitId: postGetByUnitIdMock,
  },
}));
mock.module("@/post/post.mapper", () => ({
  mapPostToDTO: (row: unknown) => row,
}));
mock.module("@/unit/language-resolution", () => ({
  resolveEffectiveReadLanguageInput: () => ({ language: "ja" }),
  resolveEffectiveReadLanguageCandidates: () => ["ja", "en"],
}));
mock.module("@/unit/mapper", () => ({
  mapTranslationToDTO: (row: unknown) => row,
}));
mock.module("@/utils/sanitizeUser", () => ({
  mapPublicUser: (user: unknown) => user ?? null,
}));
mock.module("@/utils/userSlugHydration", () => ({
  hydrateUnitOwnerUserSlugRow: async (row: unknown) => row,
  hydrateUnitOwnerUserSlugs: async (rows: unknown) => rows,
  loadUserSlugMap: async () => new Map(),
}));
mock.module("@/infra/slug-scopes", () => ({
  requireSlugScopeId: () => "realm-scope",
}));
mock.module("./realm-extra.service", () => ({
  appendToList: appendToListMock,
  filterRealmExtraPublic: mock(async (extra: unknown) => extra),
  readListAdmin: mock(async () => ({ unitIds: ["unit-1"], staleIds: [] })),
  readListPublic: mock(async () => ["unit-1"]),
  removeFromList: removeFromListMock,
  reorderList: reorderListMock,
  setSingleExtraKey: setSingleExtraKeyMock,
  clearSingleExtraKey: clearSingleExtraKeyMock,
}));

function sqlValues(condition: unknown): unknown[] {
  const values: unknown[] = [];
  function walk(value: unknown): void {
    if (!value || typeof value !== "object") return;
    const maybeValue = (value as { value?: unknown }).value;
    if (
      maybeValue !== undefined &&
      !Array.isArray(maybeValue) &&
      (typeof maybeValue === "string" ||
        typeof maybeValue === "number" ||
        typeof maybeValue === "boolean")
    ) {
      values.push(maybeValue);
    }
    const chunks = (value as { queryChunks?: unknown[] }).queryChunks;
    if (Array.isArray(chunks)) {
      for (const chunk of chunks) walk(chunk);
    }
  }
  walk(condition);
  return values;
}

function containsSqlToken(value: unknown, token: string): boolean {
  if (!value || typeof value !== "object") return false;
  const maybeValue = (value as { value?: unknown }).value;
  if (
    Array.isArray(maybeValue) &&
    maybeValue.some((part) => typeof part === "string" && part.includes(token))
  ) {
    return true;
  }
  const chunks = (value as { queryChunks?: unknown[] }).queryChunks;
  return Array.isArray(chunks)
    ? chunks.some((chunk) => containsSqlToken(chunk, token))
    : false;
}

function normalizeCounterData(data: Record<string, unknown>) {
  if (!data.subscriberCount) return data;
  return {
    ...data,
    subscriberCount: containsSqlToken(data.subscriberCount, "-")
      ? { decrement: 1 }
      : { increment: 1 },
  };
}

let latestRuleUnit: any = null;

function createFakeSelect(selection?: Record<string, unknown>) {
  let table: unknown;
  let condition: unknown;
  let skip = 0;
  let take: number | undefined;
  const query = {
    from: mock((nextTable: unknown) => {
      table = nextTable;
      return query;
    }),
    innerJoin: mock(() => query),
    where: mock((nextCondition: unknown) => {
      condition = nextCondition;
      return query;
    }),
    orderBy: mock(() => query),
    offset: mock((nextSkip: number) => {
      skip = nextSkip;
      return query;
    }),
    limit: mock((nextTake: number) => {
      take = nextTake;
      return query;
    }),
    async resolve() {
      const values = sqlValues(condition);
      if (table === Realm) {
        const selectionKeys = Object.keys(selection ?? {});
        const readLanguages = values.some(
          (value) => value === "ja" || value === "en",
        )
          ? values.filter(
              (value): value is string => value === "ja" || value === "en",
            )
          : ["ja", "en"];
        const where =
          readLanguages.length > 0
            ? {
                AND: [
                  { unit: { status: "PUBLISHED", type: "REALM" } },
                  {
                    unit: {
                      OR: [
                        { isLanguageNeutral: true },
                        {
                          supportLanguages: {
                            some: { language: { in: readLanguages } },
                          },
                        },
                      ],
                    },
                  },
                ],
              }
            : {};
        if (selection?.total) {
          return [{ total: await legacyDbMock.realm?.count?.({ where }) }];
        }
        if (selectionKeys.length === 1 && selection?.unitId) {
          return (
            (await legacyDbMock.realm?.findMany?.({
              where,
              skip,
              take,
            })) ?? []
          );
        }
        const row = await legacyDbMock.realm?.findUnique?.({
          where: { unitId: values[0] },
        });
        return row ? [row] : [];
      }
      if (table === RealmMember) {
        if (selection?.userId && !selection?.realmUnitId) {
          return legacyDbMock.realmMember?.findMany?.({ where: {} }) ?? [];
        }
        const row = await legacyDbMock.realmMember?.findUnique?.({
          where: {
            realmUnitId_userId: {
              realmUnitId: values[0],
              userId: values[1],
            },
          },
        });
        return row ? [row] : [];
      }
      if (table === Subscription) {
        const row = await legacyDbMock.subscription?.findUnique?.({
          where: {
            subscriberUnitId_subscribedUnitId: {
              subscriberUnitId: values[0],
              subscribedUnitId: values[1],
            },
          },
        });
        return row ? [row] : [];
      }
      if (table === UserSubscriptionListEntry) {
        if (selection?.position && !selection?.state) {
          const rows =
            (await legacyDbMock.userSubscriptionListEntry?.findMany?.({
              where: {},
            })) ?? [];
          return rows.map((row: any) => ({ position: row.position }));
        }
        const row = await legacyDbMock.userSubscriptionListEntry?.findUnique?.({
          where: {
            userUnitId_subscribedUnitId: {
              userUnitId: values[0],
              subscribedUnitId: values[1],
            },
          },
        });
        return row ? [row] : [];
      }
      if (table === RealmRuleAcknowledgement) {
        const finder =
          legacyDbMock.realmRuleAcknowledgement?.findUnique ??
          legacyDbMock.realmRuleAcknowledgement?.findFirst;
        const row = await finder?.({ where: {} });
        return row ? [row] : [];
      }
      if (table === Unit) {
        const row = await legacyDbMock.unit?.findUnique?.({
          where: { id: values[0] },
        });
        latestRuleUnit = row;
        return row ? [row] : [];
      }
      if (table === UnitSupportLanguage) {
        return latestRuleUnit?.supportLanguages ?? [];
      }
      if (table === UnitTranslation) {
        return latestRuleUnit?.translations ?? [];
      }
      if (table === User) return [];
      return [];
    },
    // biome-ignore lint/suspicious/noThenProperty lint/complexity/useLiteralKeys: Drizzle test double must be awaitable.
    ["then"](
      resolve: (value: unknown[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return query.resolve().then(resolve, reject);
    },
  };
  return query;
}

function createFakeInsert(table: unknown) {
  let data: Record<string, unknown> = {};
  let conflictSet: Record<string, unknown> = {};
  const query = {
    values: mock((nextData: Record<string, unknown>) => {
      data = nextData;
      return query;
    }),
    onConflictDoUpdate: mock((input: { set?: Record<string, unknown> }) => {
      conflictSet = input.set ?? {};
      return query;
    }),
    returning: mock(async () => {
      if (table === RealmMember) {
        return [await legacyDbMock.realmMember.create({ data })];
      }
      if (table === UserSubscriptionListEntry) {
        return [
          await legacyDbMock.userSubscriptionListEntry.upsert({
            where: {
              userUnitId_subscribedUnitId: {
                userUnitId: data.userUnitId,
                subscribedUnitId: data.subscribedUnitId,
              },
            },
            create: data,
            update: conflictSet,
          }),
        ];
      }
      if (table === RealmRuleAcknowledgement) {
        return [
          await legacyDbMock.realmRuleAcknowledgement.upsert({
            where: {
              realmUnitId_ruleUnitId_version_userId: {
                realmUnitId: data.realmUnitId,
                ruleUnitId: data.ruleUnitId,
                version: data.version,
                userId: data.userId,
              },
            },
            create: data,
            update: data,
          }),
        ];
      }
      return [{ ...data }];
    }),
    async execute() {
      if (table === Subscription) {
        await legacyDbMock.subscription.create({ data });
      }
      return [];
    },
    // biome-ignore lint/suspicious/noThenProperty lint/complexity/useLiteralKeys: Drizzle test double must be awaitable.
    ["then"](
      resolve: (value: unknown[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return query.execute().then(resolve, reject);
    },
  };
  return query;
}

function createFakeUpdate(table: unknown) {
  let data: Record<string, unknown> = {};
  const query = {
    set: mock((nextData: Record<string, unknown>) => {
      data = nextData;
      return query;
    }),
    where: mock(() => query),
    returning: mock(async () => {
      if (table === Realm) {
        return [
          await legacyDbMock.realm.update({
            where: { unitId: "realm-unit-id" },
            data,
          }),
        ];
      }
      if (table === RealmMember) {
        return [
          await legacyDbMock.realmMember.update({
            where: { realmUnitId_userId: {} },
            data,
          }),
        ];
      }
      return [{ ...data }];
    }),
    async execute() {
      if (table === Unit) {
        await legacyDbMock.unit.update({ data: normalizeCounterData(data) });
      }
      if (table === UserSubscriptionListEntry) {
        await legacyDbMock.userSubscriptionListEntry.update({ data });
      }
      return [];
    },
    // biome-ignore lint/suspicious/noThenProperty lint/complexity/useLiteralKeys: Drizzle test double must be awaitable.
    ["then"](
      resolve: (value: unknown[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return query.execute().then(resolve, reject);
    },
  };
  return query;
}

function createFakeDelete(table: unknown) {
  const query = {
    where: mock(() => query),
    async execute() {
      if (table === RealmMember) await legacyDbMock.realmMember.delete({});
      if (table === Subscription) await legacyDbMock.subscription.delete({});
      return [];
    },
    // biome-ignore lint/suspicious/noThenProperty lint/complexity/useLiteralKeys: Drizzle test double must be awaitable.
    ["then"](
      resolve: (value: unknown[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return query.execute().then(resolve, reject);
    },
  };
  return query;
}

const fakeDrizzleDb = {
  select: mock((selection?: Record<string, unknown>) =>
    createFakeSelect(selection),
  ),
  insert: mock((table: unknown) => createFakeInsert(table)),
  update: mock((table: unknown) => createFakeUpdate(table)),
  delete: mock((table: unknown) => createFakeDelete(table)),
  transaction: mock(async (fn: any) => {
    if (legacyDbMock.$transaction) {
      return legacyDbMock.$transaction(() => fn(fakeDrizzleDb));
    }
    return fn(fakeDrizzleDb);
  }),
};

mock.module("../db/client", () => ({
  db: fakeDrizzleDb,
}));
mock.module("@/governance/capability.service", () => ({
  governanceCapabilityService: {
    realmMembershipForPolicy: mock(
      async (realmUnitId: string, userId: string) => {
        const member = await legacyDbMock.realmMember?.findUnique?.({
          where: { realmUnitId_userId: { realmUnitId, userId } },
        });
        if (!member) return null;
        const roleCapabilities = ["owner", "admin", "moderator"].includes(
          member.roleKey,
        )
          ? [
              "content.pin",
              "queue.realm.decide",
              "comment.moderate",
              "realm.member.moderate",
            ].map((capability) => ({
              capability,
              scope: { kind: "realm", realmUnitId },
            }))
          : [];
        const grants =
          (await legacyDbMock.realmCapabilityGrant?.findMany?.({
            where: {},
          })) ?? [];
        return {
          realmUnitId,
          role: member.roleKey,
          capabilities: [
            ...roleCapabilities,
            ...grants.map((grant: any) => ({
              capability: grant.capability,
              scope: { kind: "realm", realmUnitId: grant.realmUnitId },
              expiresAt: grant.expiresAt,
            })),
          ],
        };
      },
    ),
  },
}));

const { realmService } = await import(
  "./realm.service.ts?realm-subscription-service-test-actual" as string
);

const REALM = "realm-unit-id";
const USER = "user-unit-id";
const currentIdentity = {
  sub: USER,
  userId: USER,
  permission: { role: "USER" as const },
  tokenType: "member-session" as const,
  iss: "rezics-server" as const,
  exp: 1_800_000_000,
  iat: 1_700_000_000,
};

interface TxOps {
  memberCreate?: ReturnType<typeof mock>;
  memberDelete?: ReturnType<typeof mock>;
  memberFindMany?: ReturnType<typeof mock>;
  memberFindUnique?: ReturnType<typeof mock>;
  realmUpdate?: ReturnType<typeof mock>;
  realmFindUnique?: ReturnType<typeof mock>;
  ruleAckFindUnique?: ReturnType<typeof mock>;
  subFindUnique?: ReturnType<typeof mock>;
  subCreate?: ReturnType<typeof mock>;
  subDelete?: ReturnType<typeof mock>;
  unitUpdate?: ReturnType<typeof mock>;
  moderationActionCreate?: ReturnType<typeof mock>;
  moderationActionFindUnique?: ReturnType<typeof mock>;
  listEntryFindMany?: ReturnType<typeof mock>;
  listEntryFindUnique?: ReturnType<typeof mock>;
  listEntryUpdate?: ReturnType<typeof mock>;
  listEntryUpsert?: ReturnType<typeof mock>;
}

function installTx(ops: TxOps) {
  legacyDbMock.$transaction = mock(
    async (fn: (tx: typeof legacyDbMock) => unknown) => fn(legacyDbMock),
  );
  legacyDbMock.realmMember = {
    create:
      ops.memberCreate ??
      mock(async () => ({
        realmUnitId: REALM,
        userId: USER,
        roleKey: "member",
      })),
    delete: ops.memberDelete ?? mock(async () => ({})),
    findMany: ops.memberFindMany ?? mock(async () => []),
    findUnique:
      ops.memberFindUnique ??
      mock(async () => ({ realmUnitId: REALM, userId: USER })),
  };
  legacyDbMock.realm = {
    update: ops.realmUpdate ?? mock(async () => ({ memberCount: 1 })),
    findUnique: ops.realmFindUnique ?? mock(async () => ({ memberCount: 0 })),
  };
  legacyDbMock.realmRuleAcknowledgement = {
    findUnique: ops.ruleAckFindUnique ?? mock(async () => null),
  };
  legacyDbMock.subscription = {
    findUnique: ops.subFindUnique ?? mock(async () => null),
    create: ops.subCreate ?? mock(async () => ({ id: "sub-1" })),
    delete: ops.subDelete ?? mock(async () => ({})),
  };
  legacyDbMock.unit = {
    update: ops.unitUpdate ?? mock(async () => ({})),
  };
  legacyDbMock.userSubscriptionListEntry = {
    findMany: ops.listEntryFindMany ?? mock(async () => []),
    findUnique: ops.listEntryFindUnique ?? mock(async () => null),
    update: ops.listEntryUpdate ?? mock(async () => ({})),
    upsert:
      ops.listEntryUpsert ??
      mock(async ({ create, update }: any) => ({
        id: "subscription-list-entry-1",
        ...create,
        ...update,
        createdAt: new Date("2026-05-28T00:00:00.000Z"),
        updatedAt: new Date("2026-05-28T00:00:00.000Z"),
      })),
  };
  legacyDbMock.moderationAction = {
    create:
      ops.moderationActionCreate ??
      mock(async ({ data }: any) => ({
        id: "moderation-action-1",
        ...data,
      })),
    findUnique: ops.moderationActionFindUnique ?? mock(async () => null),
  };
}

afterEach(() => {
  enqueueMock.mockClear();
  appendToListMock.mockClear();
  reorderListMock.mockClear();
  removeFromListMock.mockClear();
  setSingleExtraKeyMock.mockClear();
  clearSingleExtraKeyMock.mockClear();
  auditPrivilegedMutationMock.mockClear();
  broadcastMock.mockClear();
  delete legacyDbMock.$transaction;
  delete legacyDbMock.realmMember;
  delete legacyDbMock.realm;
  delete legacyDbMock.subscription;
  delete legacyDbMock.userSubscriptionListEntry;
  delete legacyDbMock.staffGrant;
  delete legacyDbMock.realmCapabilityGrant;
  delete legacyDbMock.realmRuleAcknowledgement;
  delete legacyDbMock.unit;
  delete legacyDbMock.moderationAction;
  delete legacyDbMock.unitTranslation;
  delete legacyDbMock.post;
});

describe("realmService.list", () => {
  test("preferred filtering uses support-language availability before pagination", async () => {
    const findMany = mock(async (_args?: any) => []);
    const count = mock(async (_args?: any) => 0);
    legacyDbMock.realm = {
      findMany,
      count,
    };

    await realmService.list({
      language: "ko",
      languageMode: "preferred",
      languages: "ja,en",
      start: 10,
      limit: 5,
    } as any);

    const findArgs = findMany.mock.calls[0]?.[0] as any;
    expect(findArgs.where).toEqual({
      AND: [
        { unit: { status: "PUBLISHED", type: "REALM" } },
        {
          unit: {
            OR: [
              { isLanguageNeutral: true },
              {
                supportLanguages: {
                  some: { language: { in: ["ja", "en"] } },
                },
              },
            ],
          },
        },
      ],
    });
    expect(JSON.stringify(findArgs.where)).not.toContain("translations");
    expect(count.mock.calls[0]?.[0]).toEqual({ where: findArgs.where });
    expect(findArgs.skip).toBe(10);
    expect(findArgs.take).toBe(5);
  });
});

describe("realmService.joinRealm", () => {
  test("writes RealmMember, Subscription, and bumps both counters atomically", async () => {
    installTx({});
    await realmService.joinRealm(REALM, USER);
    expect(legacyDbMock.$transaction).toHaveBeenCalledTimes(1);
    expect(legacyDbMock.realmMember.create).toHaveBeenCalledTimes(1);
    expect(legacyDbMock.realm.update).toHaveBeenCalledTimes(1); // memberCount++ — 成员数自增
    expect(legacyDbMock.subscription.create).toHaveBeenCalledTimes(1);
    expect(legacyDbMock.unit.update).toHaveBeenCalledTimes(1); // subscriberCount++ — 订阅者数自增
    const subArgs = legacyDbMock.subscription.create.mock.calls[0]?.[0] as {
      data: {
        channels: string[];
        subscriberUnitId: string;
        subscribedUnitId: string;
      };
    };
    expect(subArgs.data.channels).toEqual(["*"]);
    expect(subArgs.data.subscriberUnitId).toBe(USER);
    expect(subArgs.data.subscribedUnitId).toBe(REALM);
    expect(legacyDbMock.userSubscriptionListEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userUnitId_subscribedUnitId: {
            userUnitId: USER,
            subscribedUnitId: REALM,
          },
        },
        create: expect.objectContaining({
          userUnitId: USER,
          subscribedUnitId: REALM,
          subscribedType: "REALM",
          state: "ACTIVE",
        }),
        update: expect.objectContaining({
          subscribedType: "REALM",
          state: "ACTIVE",
        }),
      }),
    );
  });

  test("preserves existing Subscription (lurker→member) without double-bumping subscriberCount", async () => {
    installTx({
      subFindUnique: mock(async () => ({ id: "sub-existing" })),
    });
    await realmService.joinRealm(REALM, USER);
    expect(legacyDbMock.realmMember.create).toHaveBeenCalledTimes(1);
    expect(legacyDbMock.realm.update).toHaveBeenCalledTimes(1); // memberCount++ still — 成员数仍自增
    expect(legacyDbMock.subscription.create).toHaveBeenCalledTimes(0); // no new sub — 不创建新订阅
    expect(legacyDbMock.unit.update).toHaveBeenCalledTimes(0); // subscriberCount NOT bumped — 订阅者数不增加
    expect(legacyDbMock.userSubscriptionListEntry.upsert).toHaveBeenCalledTimes(
      1,
    );
  });

  test("requires current rule acknowledgement before joining when configured", async () => {
    installTx({
      realmFindUnique: mock(async () => ({
        extra: { rule: "rule-unit-1" },
        ruleVersion: 2,
        ruleRequireOnJoin: true,
        joinRequiresApproval: false,
      })),
      ruleAckFindUnique: mock(async () => null),
    });

    await expect(realmService.joinRealm(REALM, USER)).rejects.toThrow(
      "Realm rules must be acknowledged before joining",
    );
    expect(legacyDbMock.realmMember.create).not.toHaveBeenCalled();
  });

  test("creates pending membership when join approval is required", async () => {
    installTx({
      memberCreate: mock(async () => ({
        realmUnitId: REALM,
        userId: USER,
        roleKey: "member",
        state: "PENDING",
      })),
      memberFindMany: mock(async () => [
        { userId: "owner-1" },
        { userId: "moderator-1" },
      ]),
      realmFindUnique: mock(async () => ({
        extra: {},
        ruleVersion: 1,
        ruleRequireOnJoin: false,
        joinRequiresApproval: true,
      })),
    });

    await realmService.joinRealm(REALM, USER);

    expect(legacyDbMock.realmMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          state: "PENDING",
          onboardingCompletedAt: null,
        }),
      }),
    );
    expect(broadcastMock).toHaveBeenCalledWith({
      kind: "realm.join.requested",
      sourceUnitId: REALM,
      directRecipients: ["owner-1", "moderator-1"],
      directOnly: true,
      actorId: USER,
      extra: { memberUserId: USER },
    });
  });
});

describe("realmService.removeMember", () => {
  test("deletes both rows and decrements both counters when both exist", async () => {
    installTx({
      subFindUnique: mock(async () => ({ id: "sub-1" })),
      realmUpdate: mock(async () => ({ memberCount: 0 })),
    });
    await realmService.removeMember(REALM, USER);
    expect(legacyDbMock.realmMember.delete).toHaveBeenCalledTimes(1);
    expect(legacyDbMock.realm.update).toHaveBeenCalledTimes(1); // memberCount-- — 成员数自减
    expect(legacyDbMock.subscription.delete).toHaveBeenCalledTimes(1);
    expect(legacyDbMock.unit.update).toHaveBeenCalledTimes(1); // subscriberCount-- — 订阅者数自减
    expect(legacyDbMock.userSubscriptionListEntry.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        state: "REMOVED",
        pinned: false,
      }),
    });
  });

  test("idempotent for missing member — no decrement of memberCount", async () => {
    installTx({
      memberFindUnique: mock(async () => null),
      subFindUnique: mock(async () => null),
      realmFindUnique: mock(async () => ({ memberCount: 3 })),
    });
    await realmService.removeMember(REALM, USER);
    expect(legacyDbMock.realmMember.delete).toHaveBeenCalledTimes(0);
    expect(legacyDbMock.realm.update).toHaveBeenCalledTimes(0);
    expect(legacyDbMock.subscription.delete).toHaveBeenCalledTimes(0);
    expect(legacyDbMock.unit.update).toHaveBeenCalledTimes(0);
    expect(legacyDbMock.userSubscriptionListEntry.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        state: "REMOVED",
        pinned: false,
      }),
    });
  });

  test("idempotent for missing subscription (already muted) — only member side affected", async () => {
    installTx({
      subFindUnique: mock(async () => null),
      realmUpdate: mock(async () => ({ memberCount: 0 })),
    });
    await realmService.removeMember(REALM, USER);
    expect(legacyDbMock.realmMember.delete).toHaveBeenCalledTimes(1);
    expect(legacyDbMock.realm.update).toHaveBeenCalledTimes(1);
    expect(legacyDbMock.subscription.delete).toHaveBeenCalledTimes(0);
    expect(legacyDbMock.unit.update).toHaveBeenCalledTimes(0);
  });

  test("records a realm-member moderation action when a moderator removes a member", async () => {
    installTx({
      subFindUnique: mock(async () => null),
      realmUpdate: mock(async () => ({ memberCount: 0 })),
    });

    await realmService.removeMember(REALM, USER, {
      moderation: {
        actorUserId: "moderator-1",
        reasonCode: "realm.member.removed",
        reasonText: "off topic",
        caseId: "case-1",
      },
    });

    expect(legacyDbMock.moderationAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        authority: "REALM",
        realmUnitId: REALM,
        targetKind: "REALM_MEMBER",
        targetId: USER,
        actionKind: "REMOVE_MEMBER",
        actorUserId: "moderator-1",
        reasonCode: "realm.member.removed",
        reasonText: "off topic",
        caseId: "case-1",
      }),
    });
  });
});

describe("realmService.muteRealm", () => {
  test("deletes Subscription and decrements subscriberCount", async () => {
    installTx({
      subFindUnique: mock(async () => ({ id: "sub-1" })),
    });
    await realmService.muteRealm(REALM, USER);
    expect(legacyDbMock.subscription.delete).toHaveBeenCalledTimes(1);
    expect(legacyDbMock.unit.update).toHaveBeenCalledTimes(1);
    const unitArgs = legacyDbMock.unit.update.mock.calls[0]?.[0] as {
      data: { subscriberCount: { decrement: number } };
    };
    expect(unitArgs.data.subscriberCount).toEqual({ decrement: 1 });
    expect(legacyDbMock.userSubscriptionListEntry.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        state: "REMOVED",
        pinned: false,
      }),
    });
  });

  test("idempotent — no-op when already muted", async () => {
    installTx({
      subFindUnique: mock(async () => null),
    });
    await realmService.muteRealm(REALM, USER);
    expect(legacyDbMock.subscription.delete).toHaveBeenCalledTimes(0);
    expect(legacyDbMock.unit.update).toHaveBeenCalledTimes(0);
    expect(legacyDbMock.userSubscriptionListEntry.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        state: "REMOVED",
        pinned: false,
      }),
    });
  });
});

describe("realmService.unmuteRealm", () => {
  test("creates Subscription with channels=['*'] and increments subscriberCount", async () => {
    installTx({
      subFindUnique: mock(async () => null),
    });
    await realmService.unmuteRealm(REALM, USER);
    expect(legacyDbMock.subscription.create).toHaveBeenCalledTimes(1);
    const subArgs = legacyDbMock.subscription.create.mock.calls[0]?.[0] as {
      data: { channels: string[] };
    };
    expect(subArgs.data.channels).toEqual(["*"]);
    expect(legacyDbMock.unit.update).toHaveBeenCalledTimes(1);
    const unitArgs = legacyDbMock.unit.update.mock.calls[0]?.[0] as {
      data: { subscriberCount: { increment: number } };
    };
    expect(unitArgs.data.subscriberCount).toEqual({ increment: 1 });
    expect(legacyDbMock.userSubscriptionListEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userUnitId: USER,
          subscribedUnitId: REALM,
          subscribedType: "REALM",
          state: "ACTIVE",
        }),
      }),
    );
  });

  test("idempotent — no-op when subscription already exists", async () => {
    installTx({
      subFindUnique: mock(async () => ({ id: "sub-1" })),
    });
    await realmService.unmuteRealm(REALM, USER);
    expect(legacyDbMock.subscription.create).toHaveBeenCalledTimes(0);
    expect(legacyDbMock.unit.update).toHaveBeenCalledTimes(0);
    expect(legacyDbMock.userSubscriptionListEntry.upsert).toHaveBeenCalledTimes(
      1,
    );
  });
});

describe("realmService.getMember", () => {
  test("returns UI-only realm capability hints with membership", async () => {
    legacyDbMock.realmMember = {
      findUnique: mock(async () => ({
        realmUnitId: REALM,
        userId: USER,
        roleKey: "moderator",
        joinedAt: new Date("2026-05-28T00:00:00.000Z"),
        updatedAt: new Date("2026-05-28T00:00:00.000Z"),
      })),
    };
    legacyDbMock.staffGrant = {
      findMany: mock(async () => []),
    };
    legacyDbMock.realmCapabilityGrant = {
      findMany: mock(async () => [
        {
          capability: "tag.curate",
          realmUnitId: REALM,
          state: "ACTIVE",
          expiresAt: null,
        },
      ]),
    };

    await expect(realmService.getMember(REALM, USER)).resolves.toMatchObject({
      realmUnitId: REALM,
      userId: USER,
      roleKey: "moderator",
      capabilities: [
        {
          capability: "content.pin",
          scope: { kind: "realm", realmUnitId: REALM },
        },
        {
          capability: "queue.realm.decide",
          scope: { kind: "realm", realmUnitId: REALM },
        },
        {
          capability: "comment.moderate",
          scope: { kind: "realm", realmUnitId: REALM },
        },
        {
          capability: "realm.member.moderate",
          scope: { kind: "realm", realmUnitId: REALM },
        },
        {
          capability: "tag.curate",
          scope: { kind: "realm", realmUnitId: REALM },
          expiresAt: null,
        },
      ],
    });
  });
});

describe("realmService.getMembershipMe", () => {
  test("returns state, capability hints, and stale rule acknowledgement metadata", async () => {
    legacyDbMock.realmMember = {
      findUnique: mock(async () => ({
        realmUnitId: REALM,
        userId: USER,
        roleKey: "member",
        state: "MUTED",
        joinedAt: new Date("2026-05-28T00:00:00.000Z"),
        updatedAt: new Date("2026-05-28T00:00:00.000Z"),
      })),
    };
    legacyDbMock.staffGrant = {
      findMany: mock(async () => []),
    };
    legacyDbMock.realmCapabilityGrant = {
      findMany: mock(async () => []),
    };
    legacyDbMock.realm = {
      findUnique: mock(async () => ({
        extra: { rule: "rule-unit-2" },
        ruleVersion: 1,
        ruleRequireOnJoin: false,
        ruleRequireOnPost: true,
        ruleRequireOnUpdate: true,
      })),
    };
    legacyDbMock.realmRuleAcknowledgement = {
      findFirst: mock(async () => ({
        realmUnitId: REALM,
        ruleUnitId: "rule-unit-1",
        version: 4,
        userId: USER,
        acceptedAt: new Date("2026-05-28T00:00:00.000Z"),
        acceptedLanguage: "en",
      })),
    };

    await expect(
      realmService.getMembershipMe(REALM, USER),
    ).resolves.toMatchObject({
      realmUnitId: REALM,
      userId: USER,
      roleKey: "member",
      state: "muted",
      muted: true,
      banned: false,
      ruleAcknowledgement: {
        currentRuleUnitId: "rule-unit-2",
        requiredVersion: 1,
        acceptedRuleUnitId: "rule-unit-1",
        acceptedVersion: 4,
        acceptedLanguage: "en",
        acknowledgementRequired: true,
      },
    });
  });

  test("returns non-member metadata without requiring acknowledgement when no rule is configured", async () => {
    legacyDbMock.realmMember = {
      findUnique: mock(async () => null),
    };
    legacyDbMock.realm = {
      findUnique: mock(async () => ({
        extra: {},
        ruleVersion: 1,
        ruleRequireOnJoin: false,
        ruleRequireOnPost: false,
        ruleRequireOnUpdate: true,
      })),
    };
    legacyDbMock.realmRuleAcknowledgement = {
      findFirst: mock(async () => null),
    };

    await expect(
      realmService.getMembershipMe(REALM, USER),
    ).resolves.toMatchObject({
      realmUnitId: REALM,
      userId: USER,
      member: null,
      roleKey: null,
      state: null,
      muted: false,
      banned: false,
      capabilities: [],
      ruleAcknowledgement: {
        currentRuleUnitId: null,
        requiredVersion: null,
        acceptedRuleUnitId: null,
        acceptedVersion: null,
        acknowledgementRequired: false,
      },
    });
  });
});

describe("realmService.acknowledgeCurrentRule", () => {
  test("upserts acknowledgement for current rule unit and version", async () => {
    const acceptedAt = new Date("2026-05-28T00:00:00.000Z");
    legacyDbMock.realm = {
      findUnique: mock(async () => ({
        extra: { rule: "rule-unit-1" },
        ruleVersion: 3,
      })),
    };
    legacyDbMock.realmRuleAcknowledgement = {
      upsert: mock(async () => ({
        realmUnitId: REALM,
        ruleUnitId: "rule-unit-1",
        version: 3,
        userId: USER,
        acceptedAt,
        acceptedLanguage: "ja",
      })),
    };

    await expect(
      realmService.acknowledgeCurrentRule(REALM, USER, {
        acceptedLanguage: "ja",
      }),
    ).resolves.toEqual({
      realmUnitId: REALM,
      ruleUnitId: "rule-unit-1",
      version: 3,
      userId: USER,
      acceptedAt,
      acceptedLanguage: "ja",
    });

    expect(legacyDbMock.realmRuleAcknowledgement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          realmUnitId_ruleUnitId_version_userId: {
            realmUnitId: REALM,
            ruleUnitId: "rule-unit-1",
            version: 3,
            userId: USER,
          },
        },
      }),
    );
  });
});

describe("realmService.getRulePolicy", () => {
  test("returns the current rule reference and gates", async () => {
    const updatedAt = new Date("2026-05-28T00:00:00.000Z");
    legacyDbMock.realm = {
      findUnique: mock(async () => ({
        unitId: REALM,
        extra: { rule: "rule-unit-1" },
        ruleVersion: 3,
        ruleRequireOnJoin: true,
        ruleRequireOnPost: false,
        ruleRequireOnUpdate: true,
        rulePolicyUpdatedAt: updatedAt,
      })),
    };

    await expect(realmService.getRulePolicy(REALM)).resolves.toEqual({
      realmUnitId: REALM,
      ruleUnitId: "rule-unit-1",
      version: 3,
      requireOnJoin: true,
      requireOnPost: false,
      requireOnUpdate: true,
      updatedAt,
    });
  });
});

describe("realmService.resolveRule", () => {
  test("resolves the requested translation and source rule post", async () => {
    const now = new Date("2026-05-28T00:00:00.000Z");
    legacyDbMock.realm = {
      findUnique: mock(async () => ({
        unitId: REALM,
        extra: { rule: "rule-unit-1" },
        ruleVersion: 3,
        ruleRequireOnJoin: true,
        ruleRequireOnPost: false,
        ruleRequireOnUpdate: true,
        rulePolicyUpdatedAt: now,
      })),
    };
    legacyDbMock.unit = {
      findUnique: mock(async () => ({
        id: "rule-unit-1",
        type: "POST",
        supportLanguages: [
          {
            unitId: "rule-unit-1",
            language: "ja",
            isPrimary: true,
            sortOrder: 0,
          },
          {
            unitId: "rule-unit-1",
            language: "en",
            isPrimary: false,
            sortOrder: 1,
          },
        ],
        translations: [
          {
            unitId: "rule-unit-1",
            language: "ja",
            title: "ルール",
            subtitle: null,
            summary: null,
            description: null,
            extra: null,
            sourceUnitId: "rule-post-ja",
            createdAt: now,
            updatedAt: now,
          },
        ],
      })),
    };
    legacyDbMock.post = {
      findUnique: mock(async () => ({
        unitId: "rule-post-ja",
        authorUserId: USER,
        subscribedUnitId: null,
        content: { type: "doc", content: [] },
        rootPostUnitId: "rule-post-ja",
        parentPostUnitId: null,
        kind: "POST",
        scoreEntryId: null,
        depth: 0,
        replyCount: 0,
        directReplyCount: 0,
        lastReplyAt: null,
        isLocked: false,
        extra: null,
        createdAt: now,
        updatedAt: now,
        unit: {
          targetUnitId: null,
          status: "PUBLISHED",
          visibility: "PUBLIC",
          moderationStatus: "APPROVED",
          licenseSlug: null,
          inRealms: [],
          supportLanguages: [
            {
              unitId: "rule-post-ja",
              language: "ja",
              isPrimary: true,
              sortOrder: 0,
            },
          ],
          translations: [],
          contentTranslations: [],
          user: {
            unitId: USER,
            slug: "owner",
            name: "Owner",
            avatar: null,
          },
        },
      })),
    };

    await expect(realmService.resolveRule(REALM, "ja")).resolves.toMatchObject({
      realmUnitId: REALM,
      ruleUnitId: "rule-unit-1",
      requestedLanguage: "ja",
      resolvedLanguage: "ja",
      translation: {
        unitId: "rule-unit-1",
        language: "ja",
        title: "ルール",
        sourceUnitId: "rule-post-ja",
      },
      sourceRulePostUnitId: "rule-post-ja",
      sourceRulePost: {
        unitId: "rule-post-ja",
        authorUserId: USER,
      },
    });
  });
});

describe("realmService.updateRulePolicy", () => {
  test("updates the rule reference and acknowledgement gates", async () => {
    const updatedAt = new Date("2026-05-28T00:00:00.000Z");
    legacyDbMock.realm = {
      update: mock(async () => ({
        unitId: REALM,
        extra: { rule: "rule-unit-2" },
        ruleVersion: 4,
        ruleRequireOnJoin: true,
        ruleRequireOnPost: true,
        ruleRequireOnUpdate: false,
        rulePolicyUpdatedAt: updatedAt,
      })),
    };

    await expect(
      realmService.updateRulePolicy(currentIdentity, REALM, {
        ruleUnitId: "rule-unit-2",
        version: 4,
        requireOnJoin: true,
        requireOnPost: true,
        requireOnUpdate: false,
      }),
    ).resolves.toEqual({
      realmUnitId: REALM,
      ruleUnitId: "rule-unit-2",
      version: 4,
      requireOnJoin: true,
      requireOnPost: true,
      requireOnUpdate: false,
      updatedAt,
    });

    expect(setSingleExtraKeyMock).toHaveBeenCalledWith(
      currentIdentity,
      REALM,
      "rule",
      "rule-unit-2",
    );
    expect(legacyDbMock.realm.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { unitId: REALM },
        data: expect.objectContaining({
          ruleVersion: 4,
          ruleRequireOnJoin: true,
          ruleRequireOnPost: true,
          ruleRequireOnUpdate: false,
          rulePolicyUpdatedAt: expect.any(Date),
        }),
      }),
    );
    expect(auditPrivilegedMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER,
        action: "realm.rules.update",
        targetKind: "realm-rules",
        targetId: REALM,
        metadata: expect.objectContaining({
          ruleUnitId: "rule-unit-2",
          version: 4,
          requireOnJoin: true,
          requireOnPost: true,
          requireOnUpdate: false,
        }),
      }),
    );
    expect(broadcastMock).toHaveBeenCalledWith({
      kind: "realm.rules.updated",
      sourceUnitId: REALM,
      actorId: USER,
      extra: {
        ruleUnitId: "rule-unit-2",
        version: 4,
      },
    });
  });

  test("clears the rule reference when ruleUnitId is null", async () => {
    legacyDbMock.realm = {
      update: mock(async () => ({
        unitId: REALM,
        extra: {},
        ruleVersion: 5,
        ruleRequireOnJoin: false,
        ruleRequireOnPost: false,
        ruleRequireOnUpdate: true,
        rulePolicyUpdatedAt: null,
      })),
    };

    await expect(
      realmService.updateRulePolicy(currentIdentity, REALM, {
        ruleUnitId: null,
      }),
    ).resolves.toMatchObject({
      realmUnitId: REALM,
      ruleUnitId: null,
      version: 5,
    });

    expect(clearSingleExtraKeyMock).toHaveBeenCalledWith(
      currentIdentity,
      REALM,
      "rule",
    );
    expect(setSingleExtraKeyMock).not.toHaveBeenCalled();
  });
});

describe("realmService community list wrappers", () => {
  test("appends to pinboard through Realm.extra and writes audit metadata", async () => {
    await expect(
      realmService.appendCommunityList(
        currentIdentity,
        REALM,
        "pinboard",
        "unit-2",
      ),
    ).resolves.toEqual({ ok: true, unitIds: ["unit-1", "unit-2"] });

    expect(appendToListMock).toHaveBeenCalledWith(
      currentIdentity,
      REALM,
      "pinboard",
      "unit-2",
    );
    expect(auditPrivilegedMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER,
        action: "content.pin",
        targetKind: "realm-pinboard",
        targetId: REALM,
        metadata: expect.objectContaining({
          key: "pinboard",
          operation: "append",
          unitId: "unit-2",
        }),
      }),
    );
  });

  test("reorders and removes announcement entries through Realm.extra", async () => {
    await expect(
      realmService.reorderCommunityList(
        currentIdentity,
        REALM,
        "announcement",
        ["unit-2", "unit-1"],
      ),
    ).resolves.toEqual({ ok: true, unitIds: ["unit-2", "unit-1"] });
    await expect(
      realmService.removeCommunityListEntry(
        currentIdentity,
        REALM,
        "announcement",
        "unit-1",
      ),
    ).resolves.toEqual({ ok: true, unitIds: ["unit-2"] });

    expect(reorderListMock).toHaveBeenCalledWith(
      currentIdentity,
      REALM,
      "announcement",
      ["unit-2", "unit-1"],
    );
    expect(removeFromListMock).toHaveBeenCalledWith(
      currentIdentity,
      REALM,
      "announcement",
      "unit-1",
    );
    expect(auditPrivilegedMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "content.pin",
        targetKind: "realm-announcement",
        metadata: expect.objectContaining({ operation: "remove" }),
      }),
    );
  });
});
