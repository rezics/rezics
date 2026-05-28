import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

installPrismaClientMock();

// Stub fire-and-forget meili sync so it doesn't reach into real env.
const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
const appendToListMock = mock(async () => ({
  unitIds: ["unit-1", "unit-2"],
}));
const reorderListMock = mock(async (_caller, _realmId, _key, unitIds) => ({
  unitIds,
}));
const removeFromListMock = mock(async () => ({ unitIds: ["unit-2"] }));
const auditPrivilegedMutationMock = mock(async () => ({ id: "audit-1" }));
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
mock.module("./realm-extra.service", () => ({
  appendToList: appendToListMock,
  filterRealmExtraPublic: mock(async (extra: unknown) => extra),
  readListAdmin: mock(async () => ({ unitIds: ["unit-1"], staleIds: [] })),
  readListPublic: mock(async () => ["unit-1"]),
  removeFromList: removeFromListMock,
  reorderList: reorderListMock,
}));

import { realmService } from "./realm.service";

const REALM = "realm-unit-id";
const USER = "user-unit-id";
const currentIdentity = {
  sub: USER,
  userId: USER,
  permission: { role: "USER" as const },
};

interface TxOps {
  memberCreate?: ReturnType<typeof mock>;
  memberDelete?: ReturnType<typeof mock>;
  memberFindUnique?: ReturnType<typeof mock>;
  realmUpdate?: ReturnType<typeof mock>;
  realmFindUnique?: ReturnType<typeof mock>;
  subFindUnique?: ReturnType<typeof mock>;
  subCreate?: ReturnType<typeof mock>;
  subDelete?: ReturnType<typeof mock>;
  unitUpdate?: ReturnType<typeof mock>;
}

function installTx(ops: TxOps) {
  prismaMock.$transaction = mock(
    async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock),
  );
  prismaMock.realmMember = {
    create:
      ops.memberCreate ??
      mock(async () => ({
        realmUnitId: REALM,
        userId: USER,
        roleKey: "member",
      })),
    delete: ops.memberDelete ?? mock(async () => ({})),
    findUnique:
      ops.memberFindUnique ??
      mock(async () => ({ realmUnitId: REALM, userId: USER })),
  };
  prismaMock.realm = {
    update: ops.realmUpdate ?? mock(async () => ({ memberCount: 1 })),
    findUnique: ops.realmFindUnique ?? mock(async () => ({ memberCount: 0 })),
  };
  prismaMock.subscription = {
    findUnique: ops.subFindUnique ?? mock(async () => null),
    create: ops.subCreate ?? mock(async () => ({ id: "sub-1" })),
    delete: ops.subDelete ?? mock(async () => ({})),
  };
  prismaMock.unit = {
    update: ops.unitUpdate ?? mock(async () => ({})),
  };
}

afterEach(() => {
  enqueueMock.mockClear();
  appendToListMock.mockClear();
  reorderListMock.mockClear();
  removeFromListMock.mockClear();
  auditPrivilegedMutationMock.mockClear();
  delete prismaMock.$transaction;
  delete prismaMock.realmMember;
  delete prismaMock.realm;
  delete prismaMock.subscription;
  delete prismaMock.staffGrant;
  delete prismaMock.realmCapabilityGrant;
  delete prismaMock.realmRuleAcknowledgement;
  delete prismaMock.unit;
});

describe("realmService.joinRealm", () => {
  test("writes RealmMember, Subscription, and bumps both counters atomically", async () => {
    installTx({});
    await realmService.joinRealm(REALM, USER);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.realmMember.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.realm.update).toHaveBeenCalledTimes(1); // memberCount++
    expect(prismaMock.subscription.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.unit.update).toHaveBeenCalledTimes(1); // subscriberCount++
    const subArgs = prismaMock.subscription.create.mock.calls[0]?.[0] as {
      data: {
        channels: string[];
        subscriberUnitId: string;
        targetUnitId: string;
      };
    };
    expect(subArgs.data.channels).toEqual(["*"]);
    expect(subArgs.data.subscriberUnitId).toBe(USER);
    expect(subArgs.data.targetUnitId).toBe(REALM);
  });

  test("preserves existing Subscription (lurker→member) without double-bumping subscriberCount", async () => {
    installTx({
      subFindUnique: mock(async () => ({ id: "sub-existing" })),
    });
    await realmService.joinRealm(REALM, USER);
    expect(prismaMock.realmMember.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.realm.update).toHaveBeenCalledTimes(1); // memberCount++ still
    expect(prismaMock.subscription.create).toHaveBeenCalledTimes(0); // no new sub
    expect(prismaMock.unit.update).toHaveBeenCalledTimes(0); // subscriberCount NOT bumped
  });
});

describe("realmService.removeMember", () => {
  test("deletes both rows and decrements both counters when both exist", async () => {
    installTx({
      subFindUnique: mock(async () => ({ id: "sub-1" })),
      realmUpdate: mock(async () => ({ memberCount: 0 })),
    });
    await realmService.removeMember(REALM, USER);
    expect(prismaMock.realmMember.delete).toHaveBeenCalledTimes(1);
    expect(prismaMock.realm.update).toHaveBeenCalledTimes(1); // memberCount--
    expect(prismaMock.subscription.delete).toHaveBeenCalledTimes(1);
    expect(prismaMock.unit.update).toHaveBeenCalledTimes(1); // subscriberCount--
  });

  test("idempotent for missing member — no decrement of memberCount", async () => {
    installTx({
      memberFindUnique: mock(async () => null),
      subFindUnique: mock(async () => null),
      realmFindUnique: mock(async () => ({ memberCount: 3 })),
    });
    await realmService.removeMember(REALM, USER);
    expect(prismaMock.realmMember.delete).toHaveBeenCalledTimes(0);
    expect(prismaMock.realm.update).toHaveBeenCalledTimes(0);
    expect(prismaMock.subscription.delete).toHaveBeenCalledTimes(0);
    expect(prismaMock.unit.update).toHaveBeenCalledTimes(0);
  });

  test("idempotent for missing subscription (already muted) — only member side affected", async () => {
    installTx({
      subFindUnique: mock(async () => null),
      realmUpdate: mock(async () => ({ memberCount: 0 })),
    });
    await realmService.removeMember(REALM, USER);
    expect(prismaMock.realmMember.delete).toHaveBeenCalledTimes(1);
    expect(prismaMock.realm.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.subscription.delete).toHaveBeenCalledTimes(0);
    expect(prismaMock.unit.update).toHaveBeenCalledTimes(0);
  });
});

describe("realmService.muteRealm", () => {
  test("deletes Subscription and decrements subscriberCount", async () => {
    installTx({
      subFindUnique: mock(async () => ({ id: "sub-1" })),
    });
    await realmService.muteRealm(REALM, USER);
    expect(prismaMock.subscription.delete).toHaveBeenCalledTimes(1);
    expect(prismaMock.unit.update).toHaveBeenCalledTimes(1);
    const unitArgs = prismaMock.unit.update.mock.calls[0]?.[0] as {
      data: { subscriberCount: { decrement: number } };
    };
    expect(unitArgs.data.subscriberCount).toEqual({ decrement: 1 });
  });

  test("idempotent — no-op when already muted", async () => {
    installTx({
      subFindUnique: mock(async () => null),
    });
    await realmService.muteRealm(REALM, USER);
    expect(prismaMock.subscription.delete).toHaveBeenCalledTimes(0);
    expect(prismaMock.unit.update).toHaveBeenCalledTimes(0);
  });
});

describe("realmService.unmuteRealm", () => {
  test("creates Subscription with channels=['*'] and increments subscriberCount", async () => {
    installTx({
      subFindUnique: mock(async () => null),
    });
    await realmService.unmuteRealm(REALM, USER);
    expect(prismaMock.subscription.create).toHaveBeenCalledTimes(1);
    const subArgs = prismaMock.subscription.create.mock.calls[0]?.[0] as {
      data: { channels: string[] };
    };
    expect(subArgs.data.channels).toEqual(["*"]);
    expect(prismaMock.unit.update).toHaveBeenCalledTimes(1);
    const unitArgs = prismaMock.unit.update.mock.calls[0]?.[0] as {
      data: { subscriberCount: { increment: number } };
    };
    expect(unitArgs.data.subscriberCount).toEqual({ increment: 1 });
  });

  test("idempotent — no-op when subscription already exists", async () => {
    installTx({
      subFindUnique: mock(async () => ({ id: "sub-1" })),
    });
    await realmService.unmuteRealm(REALM, USER);
    expect(prismaMock.subscription.create).toHaveBeenCalledTimes(0);
    expect(prismaMock.unit.update).toHaveBeenCalledTimes(0);
  });
});

describe("realmService.getMember", () => {
  test("returns UI-only realm capability hints with membership", async () => {
    prismaMock.realmMember = {
      findUnique: mock(async () => ({
        realmUnitId: REALM,
        userId: USER,
        roleKey: "moderator",
        joinedAt: new Date("2026-05-28T00:00:00.000Z"),
        updatedAt: new Date("2026-05-28T00:00:00.000Z"),
      })),
    };
    prismaMock.staffGrant = {
      findMany: mock(async () => []),
    };
    prismaMock.realmCapabilityGrant = {
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
    prismaMock.realmMember = {
      findUnique: mock(async () => ({
        realmUnitId: REALM,
        userId: USER,
        roleKey: "member",
        state: "MUTED",
        joinedAt: new Date("2026-05-28T00:00:00.000Z"),
        updatedAt: new Date("2026-05-28T00:00:00.000Z"),
      })),
    };
    prismaMock.staffGrant = {
      findMany: mock(async () => []),
    };
    prismaMock.realmCapabilityGrant = {
      findMany: mock(async () => []),
    };
    prismaMock.realm = {
      findUnique: mock(async () => ({
        extra: { rule: "rule-unit-2" },
        ruleVersion: 1,
        ruleRequireOnJoin: false,
        ruleRequireOnPost: true,
        ruleRequireOnUpdate: true,
      })),
    };
    prismaMock.realmRuleAcknowledgement = {
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
    prismaMock.realmMember = {
      findUnique: mock(async () => null),
    };
    prismaMock.realm = {
      findUnique: mock(async () => ({
        extra: {},
        ruleVersion: 1,
        ruleRequireOnJoin: false,
        ruleRequireOnPost: false,
        ruleRequireOnUpdate: true,
      })),
    };
    prismaMock.realmRuleAcknowledgement = {
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
    prismaMock.realm = {
      findUnique: mock(async () => ({
        extra: { rule: "rule-unit-1" },
        ruleVersion: 3,
      })),
    };
    prismaMock.realmRuleAcknowledgement = {
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

    expect(prismaMock.realmRuleAcknowledgement.upsert).toHaveBeenCalledWith(
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
