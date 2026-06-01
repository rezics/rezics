import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

// Stub the notify boundary so subscribe()'s fire-and-forget broadcast
// doesn't reach into real env.
mock.module("@/notify-boundary/notify-boundary.client", () => ({
  broadcast: mock(async () => ({ ok: true })),
  defaultFindSubscriptionMatches: mock(async () => []),
  resolveRecipients: mock(async () => []),
  sendDm: mock(async () => ({ ok: true })),
  notifySystemAndEmail: mock(async () => ({ ok: true })),
}));

import { subscriptionService } from "./subscription.service";

const SUBSCRIBER = "subscriber-unit-id";
const TARGET = "target-unit-id";

function stubTransaction() {
  prismaMock.$transaction = mock(
    async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock),
  );
}

beforeEach(() => {
  prismaMock.unit = {
    findUnique: mock(async () => ({
      id: TARGET,
      type: "BOOK",
      userId: null,
    })),
    update: mock(async () => ({})),
  };
  prismaMock.subscription = {
    create: mock(async (args: { data: unknown }) => ({
      id: "sub-1",
      ...(args.data as Record<string, unknown>),
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    })),
    delete: mock(async () => ({})),
    findUnique: mock(async () => null),
    findMany: mock(async () => []),
    count: mock(async () => 0),
    update: mock(async (args: { data: unknown }) => ({
      id: "sub-1",
      subscriberUnitId: SUBSCRIBER,
      subscribedUnitId: TARGET,
      ...(args.data as Record<string, unknown>),
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    })),
  };
  prismaMock.user = { update: mock(async () => ({})) };
  prismaMock.realm = { findUnique: mock(async () => ({ isPublic: true })) };
  prismaMock.realmMember = { findUnique: mock(async () => null) };
  stubTransaction();
});

afterEach(() => {
  delete prismaMock.unit;
  delete prismaMock.subscription;
  delete prismaMock.user;
  delete prismaMock.realm;
  delete prismaMock.realmMember;
  delete prismaMock.$transaction;
});

describe("subscriptionService.subscribe", () => {
  test("rejects self-subscription with AppError 400", async () => {
    await expect(
      subscriptionService.subscribe(SUBSCRIBER, SUBSCRIBER),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("Cannot subscribe to your own"),
    });
  });

  test("rejects missing target with AppError 404", async () => {
    prismaMock.unit.findUnique = mock(async () => null);
    await expect(
      subscriptionService.subscribe(SUBSCRIBER, TARGET),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test("rejects non-subscribable subscribed unit type with AppError 400", async () => {
    prismaMock.unit.findUnique = mock(async () => ({
      id: TARGET,
      type: "QUOTE",
      userId: null,
    }));
    await expect(
      subscriptionService.subscribe(SUBSCRIBER, TARGET),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("not subscribable"),
    });
  });

  test("default channels is ['*'] when caller omits", async () => {
    const dto = await subscriptionService.subscribe(SUBSCRIBER, TARGET);
    expect(prismaMock.subscription.create).toHaveBeenCalledTimes(1);
    const call = prismaMock.subscription.create.mock.calls[0]?.[0] as {
      data: { channels: string[] };
    };
    expect(call.data.channels).toEqual(["*"]);
    expect(dto.channels).toEqual(["*"]);
  });

  test("explicit channels are validated and passed through", async () => {
    const dto = await subscriptionService.subscribe(SUBSCRIBER, TARGET, [
      "chapter.new",
    ]);
    expect(dto.channels).toEqual(["chapter.new"]);
  });

  test("rejects unknown channel for the subscribed unit type with AppError 400", async () => {
    await expect(
      subscriptionService.subscribe(SUBSCRIBER, TARGET, ["chapter.exploded"]),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("Invalid channel"),
    });
  });

  test("rejects category wildcard for unrelated category", async () => {
    await expect(
      subscriptionService.subscribe(SUBSCRIBER, TARGET, ["bogus.*"]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("accepts category wildcard registered for subscribed unit type", async () => {
    const dto = await subscriptionService.subscribe(SUBSCRIBER, TARGET, [
      "chapter.*",
    ]);
    expect(dto.channels).toEqual(["chapter.*"]);
  });

  test("blocks non-member subscription to a private realm (403)", async () => {
    prismaMock.unit.findUnique = mock(async () => ({
      id: TARGET,
      type: "REALM",
      userId: null,
    }));
    prismaMock.realm.findUnique = mock(async () => ({ isPublic: false }));
    prismaMock.realmMember.findUnique = mock(async () => null);
    await expect(
      subscriptionService.subscribe(SUBSCRIBER, TARGET),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining("private realm"),
    });
  });

  test("allows member subscription to a private realm", async () => {
    prismaMock.unit.findUnique = mock(async () => ({
      id: TARGET,
      type: "REALM",
      userId: null,
    }));
    prismaMock.realm.findUnique = mock(async () => ({ isPublic: false }));
    prismaMock.realmMember.findUnique = mock(async () => ({
      realmUnitId: TARGET,
    }));
    const dto = await subscriptionService.subscribe(SUBSCRIBER, TARGET);
    expect(dto.subscribedUnitId).toBe(TARGET);
  });

  test("USER→USER subscription bumps follower/following counters", async () => {
    prismaMock.unit.findUnique = mock(async () => ({
      id: TARGET,
      type: "USER",
      userId: null,
    }));
    await subscriptionService.subscribe(SUBSCRIBER, TARGET);
    // Two user.update calls: one for follower count, one for following count.
    expect(prismaMock.user.update.mock.calls.length).toBe(2);
  });

  test("non-USER target does NOT touch User counters", async () => {
    await subscriptionService.subscribe(SUBSCRIBER, TARGET);
    expect(prismaMock.user.update.mock.calls.length).toBe(0);
  });
});

describe("subscriptionService.unsubscribe", () => {
  test("returns false when no row exists (idempotent)", async () => {
    prismaMock.subscription.findUnique = mock(async () => null);
    const ok = await subscriptionService.unsubscribe(SUBSCRIBER, TARGET);
    expect(ok).toBe(false);
  });

  test("returns true and deletes when row exists", async () => {
    prismaMock.subscription.findUnique = mock(async () => ({ id: "sub-1" }));
    prismaMock.unit.findUnique = mock(async () => ({ type: "BOOK" }));
    const ok = await subscriptionService.unsubscribe(SUBSCRIBER, TARGET);
    expect(ok).toBe(true);
    expect(prismaMock.subscription.delete).toHaveBeenCalledTimes(1);
    expect(prismaMock.unit.update).toHaveBeenCalledTimes(1);
  });
});

describe("subscriptionService.updateChannels", () => {
  test("rejects empty channels with AppError 400", async () => {
    await expect(
      subscriptionService.updateChannels(SUBSCRIBER, TARGET, []),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("Channels cannot be empty"),
    });
  });

  test("rejects invalid channel with AppError 400", async () => {
    await expect(
      subscriptionService.updateChannels(SUBSCRIBER, TARGET, [
        "chapter.exploded",
      ]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("accepts valid channels and writes update", async () => {
    const dto = await subscriptionService.updateChannels(SUBSCRIBER, TARGET, [
      "chapter.new",
    ]);
    expect(dto.channels).toEqual(["chapter.new"]);
    expect(prismaMock.subscription.update).toHaveBeenCalledTimes(1);
  });
});

describe("subscriptionService.checkSubscription", () => {
  test("returns subscribed:false when no row", async () => {
    prismaMock.subscription.findUnique = mock(async () => null);
    const result = await subscriptionService.checkSubscription(
      SUBSCRIBER,
      TARGET,
    );
    expect(result).toEqual({ subscribed: false });
  });

  test("returns subscribed:true with channels when row exists", async () => {
    prismaMock.subscription.findUnique = mock(async () => ({
      channels: ["chapter.*"],
    }));
    const result = await subscriptionService.checkSubscription(
      SUBSCRIBER,
      TARGET,
    );
    expect(result).toEqual({ subscribed: true, channels: ["chapter.*"] });
  });
});

describe("subscriptionService.getSubscriberCount", () => {
  test("reads the denormalized Unit.subscriberCount", async () => {
    prismaMock.unit.findUnique = mock(async () => ({ subscriberCount: 17 }));
    const count = await subscriptionService.getSubscriberCount(TARGET);
    expect(count).toBe(17);
  });

  test("throws AppError 404 when target unit missing", async () => {
    prismaMock.unit.findUnique = mock(async () => null);
    await expect(
      subscriptionService.getSubscriberCount(TARGET),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
