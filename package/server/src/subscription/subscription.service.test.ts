import { describe, expect, mock, test } from "bun:test";
import {
  SubscriptionService,
  type SubscriptionRepository,
} from "./subscription.service";

const SUBSCRIBER = "subscriber-unit-id";
const TARGET = "target-unit-id";
const now = new Date("2026-01-01T00:00:00Z");

function subscriptionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    subscriberUnitId: SUBSCRIBER,
    subscribedUnitId: TARGET,
    channels: ["*"],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function freshRepository(
  overrides: Partial<SubscriptionRepository> = {},
): SubscriptionRepository {
  return {
    getTargetUnit: mock(async () => ({
      id: TARGET,
      type: "BOOK" as const,
      userId: null,
    })),
    getRealm: mock(async () => ({ isPublic: true })),
    isRealmMember: mock(async () => false),
    createWithCounters: mock(async (input) =>
      subscriptionRow({ channels: input.channels }),
    ),
    findSubscriptionId: mock(async () => undefined),
    deleteWithCounters: mock(async () => undefined),
    updateChannels: mock(async (input) =>
      subscriptionRow({ channels: input.channels }),
    ),
    listMine: mock(async () => []),
    findChannels: mock(async () => undefined),
    getSubscriberCount: mock(async () => 0),
    ...overrides,
  };
}

function createService(repository = freshRepository()) {
  return new SubscriptionService(
    repository,
    mock(async () => ({ ok: true })),
  );
}

describe("subscriptionService.subscribe", () => {
  test("rejects self-subscription with AppError 400", async () => {
    await expect(
      createService().subscribe(SUBSCRIBER, SUBSCRIBER),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("Cannot subscribe to your own"),
    });
  });

  test("rejects missing target with AppError 404", async () => {
    const repository = freshRepository({
      getTargetUnit: mock(async () => undefined),
    });

    await expect(
      createService(repository).subscribe(SUBSCRIBER, TARGET),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test("rejects non-subscribable subscribed unit type with AppError 400", async () => {
    const repository = freshRepository({
      getTargetUnit: mock(async () => ({
        id: TARGET,
        type: "QUOTE" as const,
        userId: null,
      })),
    });

    await expect(
      createService(repository).subscribe(SUBSCRIBER, TARGET),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("not subscribable"),
    });
  });

  test("default channels is ['*'] when caller omits", async () => {
    const repository = freshRepository();
    const dto = await createService(repository).subscribe(SUBSCRIBER, TARGET);

    expect(repository.createWithCounters).toHaveBeenCalledWith({
      subscriberUnitId: SUBSCRIBER,
      subscribedUnitId: TARGET,
      channels: ["*"],
      isUserToUser: false,
    });
    expect(dto.channels).toEqual(["*"]);
  });

  test("writes the requested subscribedUnitId without following Unit.targetUnitId", async () => {
    const repository = freshRepository({
      getTargetUnit: mock(
        async () =>
          ({
            id: TARGET,
            type: "BOOK" as const,
            userId: null,
            targetUnitId: "canonical-target",
          }) as any,
      ),
    });

    await createService(repository).subscribe(SUBSCRIBER, TARGET);

    expect(repository.createWithCounters).toHaveBeenCalledWith(
      expect.objectContaining({ subscribedUnitId: TARGET }),
    );
  });

  test("explicit channels are validated and passed through", async () => {
    const dto = await createService().subscribe(SUBSCRIBER, TARGET, [
      "chapter.new",
    ]);
    expect(dto.channels).toEqual(["chapter.new"]);
  });

  test("rejects unknown channel for the subscribed unit type with AppError 400", async () => {
    await expect(
      createService().subscribe(SUBSCRIBER, TARGET, ["chapter.exploded"]),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("Invalid channel"),
    });
  });

  test("rejects category wildcard for unrelated category", async () => {
    await expect(
      createService().subscribe(SUBSCRIBER, TARGET, ["bogus.*"]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("accepts category wildcard registered for subscribed unit type", async () => {
    const dto = await createService().subscribe(SUBSCRIBER, TARGET, [
      "chapter.*",
    ]);
    expect(dto.channels).toEqual(["chapter.*"]);
  });

  test("blocks non-member subscription to a private realm (403)", async () => {
    const repository = freshRepository({
      getTargetUnit: mock(async () => ({
        id: TARGET,
        type: "REALM" as const,
        userId: null,
      })),
      getRealm: mock(async () => ({ isPublic: false })),
      isRealmMember: mock(async () => false),
    });

    await expect(
      createService(repository).subscribe(SUBSCRIBER, TARGET),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining("private realm"),
    });
  });

  test("allows member subscription to a private realm", async () => {
    const repository = freshRepository({
      getTargetUnit: mock(async () => ({
        id: TARGET,
        type: "REALM" as const,
        userId: null,
      })),
      getRealm: mock(async () => ({ isPublic: false })),
      isRealmMember: mock(async () => true),
    });

    const dto = await createService(repository).subscribe(SUBSCRIBER, TARGET);
    expect(dto.subscribedUnitId).toBe(TARGET);
  });

  test("USER->USER subscription bumps follower/following counters", async () => {
    const repository = freshRepository({
      getTargetUnit: mock(async () => ({
        id: TARGET,
        type: "USER" as const,
        userId: null,
      })),
    });

    await createService(repository).subscribe(SUBSCRIBER, TARGET);

    expect(repository.createWithCounters).toHaveBeenCalledWith(
      expect.objectContaining({ isUserToUser: true }),
    );
  });

  test("non-USER target does NOT touch User counters", async () => {
    const repository = freshRepository();
    await createService(repository).subscribe(SUBSCRIBER, TARGET);
    expect(repository.createWithCounters).toHaveBeenCalledWith(
      expect.objectContaining({ isUserToUser: false }),
    );
  });
});

describe("subscriptionService.unsubscribe", () => {
  test("returns false when no row exists (idempotent)", async () => {
    const ok = await createService().unsubscribe(SUBSCRIBER, TARGET);
    expect(ok).toBe(false);
  });

  test("returns true and deletes when row exists", async () => {
    const repository = freshRepository({
      findSubscriptionId: mock(async () => "sub-1"),
    });

    const ok = await createService(repository).unsubscribe(SUBSCRIBER, TARGET);

    expect(ok).toBe(true);
    expect(repository.deleteWithCounters).toHaveBeenCalledTimes(1);
  });
});

describe("subscriptionService.updateChannels", () => {
  test("rejects empty channels with AppError 400", async () => {
    await expect(
      createService().updateChannels(SUBSCRIBER, TARGET, []),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("Channels cannot be empty"),
    });
  });

  test("rejects invalid channel with AppError 400", async () => {
    await expect(
      createService().updateChannels(SUBSCRIBER, TARGET, ["chapter.exploded"]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("accepts valid channels and writes update", async () => {
    const repository = freshRepository();
    const dto = await createService(repository).updateChannels(
      SUBSCRIBER,
      TARGET,
      ["chapter.new"],
    );

    expect(dto.channels).toEqual(["chapter.new"]);
    expect(repository.updateChannels).toHaveBeenCalledTimes(1);
  });
});

describe("subscriptionService.checkSubscription", () => {
  test("returns subscribed:false when no row", async () => {
    const result = await createService().checkSubscription(SUBSCRIBER, TARGET);
    expect(result).toEqual({ subscribed: false });
  });

  test("returns subscribed:true with channels when row exists", async () => {
    const repository = freshRepository({
      findChannels: mock(async () => ["chapter.*"]),
    });

    const result = await createService(repository).checkSubscription(
      SUBSCRIBER,
      TARGET,
    );

    expect(result).toEqual({ subscribed: true, channels: ["chapter.*"] });
  });
});

describe("subscriptionService.getSubscriberCount", () => {
  test("reads the denormalized Unit.subscriberCount", async () => {
    const repository = freshRepository({
      getSubscriberCount: mock(async () => 17),
    });

    const count = await createService(repository).getSubscriberCount(TARGET);

    expect(count).toBe(17);
  });

  test("throws AppError 404 when target unit missing", async () => {
    const repository = freshRepository({
      getSubscriberCount: mock(async () => undefined),
    });

    await expect(
      createService(repository).getSubscriberCount(TARGET),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
