import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

// Stub fire-and-forget meili sync so it doesn't reach into real env.
const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
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

import { realmService } from "./realm.service";

const REALM = "realm-unit-id";
const USER = "user-unit-id";

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
  delete prismaMock.$transaction;
  delete prismaMock.realmMember;
  delete prismaMock.realm;
  delete prismaMock.subscription;
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
