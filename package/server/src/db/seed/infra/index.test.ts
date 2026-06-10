import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  RealmMember,
  Subscription,
  Unit,
  UserSubscriptionListEntry,
} from "../../schema";
// Static imports run before the `mock.module` calls below, so these bind
// the real module namespaces for the afterAll restore: `mock.restore()`
// does not undo `mock.module`, and the stubs would otherwise leak into
// every later test file in the same process.
// 静态导入先于下方的 `mock.module` 执行，因此这里绑定的是真实模块命名
// 空间，供 afterAll 还原使用：`mock.restore()` 不会撤销 `mock.module`，
// 否则桩会泄漏到同一进程中之后的所有测试文件。
import * as realSeedDefaultRealm from "./seed-default-realm";
import * as realSeedGameMediaTaxonomy from "./seed-game-media-taxonomy";
import * as realSeedOfficialZones from "./seed-official-zones";
import * as realSeedRealmTaxonomy from "./seed-realm-taxonomy";
import * as realSeedTags from "./seed-tags";

const calls = {
  order: [] as string[],
};

mock.module("./seed-tags", () => ({
  seedContentTypeTags: mock(async () => {
    calls.order.push("content-tags");
    return {};
  }),
  seedSearchTagIds: mock(async () => {
    calls.order.push("search-tags");
    return {};
  }),
}));

mock.module("./seed-default-realm", () => ({
  seedDefaultRealm: mock(async () => {
    calls.order.push("default-realm");
    return "realm-rezics";
  }),
}));

mock.module("./seed-official-zones", () => ({
  OFFICIAL_ZONE_DEFINITIONS: [],
  seedOfficialZones: mock(async () => {
    calls.order.push("official-zones");
    return {
      book: "zone-book",
      realms: "zone-realms",
      popular: "zone-popular",
    };
  }),
}));

mock.module("./seed-realm-taxonomy", () => ({
  seedRealmTaxonomy: mock(async () => {
    calls.order.push("realm-taxonomy");
    return {};
  }),
}));

mock.module("./seed-game-media-taxonomy", () => ({
  seedGameMediaTaxonomy: mock(async () => {
    calls.order.push("game-media-taxonomy");
    return {};
  }),
}));

describe("seedInfra", () => {
  beforeEach(() => {
    calls.order = [];
  });

  test("seeds root default subscriptions after official targets exist", async () => {
    const { seedInfra } = await import("./index");
    const db = createDefaultSubscriptionMemoryDb();

    await seedInfra("root-user", {
      db: db as never,
      slugScopes: {
        user: "scope-user",
        realm: "scope-realm",
        tag: "scope-tag",
        zone: "scope-zone",
        entity: "scope-entity",
      },
    });

    expect(db.state.realmMembers).toEqual([
      { realmUnitId: "realm-rezics", userId: "root-user", roleKey: "member" },
    ]);
    expect(
      db.state.entries.map((entry) => ({
        userUnitId: entry.userUnitId,
        subscribedUnitId: entry.subscribedUnitId,
        subscribedType: entry.subscribedType,
        state: entry.state,
      })),
    ).toEqual([
      {
        userUnitId: "root-user",
        subscribedUnitId: "realm-rezics",
        subscribedType: "REALM",
        state: "ACTIVE",
      },
      {
        userUnitId: "root-user",
        subscribedUnitId: "zone-book",
        subscribedType: "ZONE",
        state: "ACTIVE",
      },
      {
        userUnitId: "root-user",
        subscribedUnitId: "zone-realms",
        subscribedType: "ZONE",
        state: "ACTIVE",
      },
      {
        userUnitId: "root-user",
        subscribedUnitId: "zone-popular",
        subscribedType: "ZONE",
        state: "ACTIVE",
      },
    ]);
    expect(calls.order.indexOf("defaults")).toBeGreaterThan(
      calls.order.indexOf("official-zones"),
    );
    expect(calls.order.indexOf("defaults")).toBeLessThan(
      calls.order.indexOf("realm-taxonomy"),
    );
  });
});

afterAll(() => {
  mock.restore();
  mock.module("./seed-tags", () => realSeedTags);
  mock.module("./seed-default-realm", () => realSeedDefaultRealm);
  mock.module("./seed-official-zones", () => realSeedOfficialZones);
  mock.module("./seed-realm-taxonomy", () => realSeedRealmTaxonomy);
  mock.module("./seed-game-media-taxonomy", () => realSeedGameMediaTaxonomy);
});

function createDefaultSubscriptionMemoryDb() {
  const state = {
    units: [
      { id: "realm-rezics", type: "REALM", subscriberCount: 0 },
      {
        id: "zone-book",
        type: "ZONE",
        slug: "book",
        slugScope: "scope-zone",
        subscriberCount: 0,
      },
      {
        id: "zone-realms",
        type: "ZONE",
        slug: "realms",
        slugScope: "scope-zone",
        subscriberCount: 0,
      },
      {
        id: "zone-popular",
        type: "ZONE",
        slug: "popular",
        slugScope: "scope-zone",
        subscriberCount: 0,
      },
    ],
    subscriptions: [] as Array<{
      id: string;
      subscriberUnitId: string;
      subscribedUnitId: string;
      channels: string[];
    }>,
    entries: [] as Array<{
      id: string;
      userUnitId: string;
      subscribedUnitId: string;
      subscribedType: "REALM" | "ZONE";
      position: string;
      pinned: boolean;
      state: "ACTIVE" | "REMOVED";
    }>,
    realmMembers: [] as Array<{
      realmUnitId: string;
      userId: string;
      roleKey: string;
    }>,
  };
  const targetIds = [
    "realm-rezics",
    "zone-book",
    "zone-realms",
    "zone-popular",
  ];
  const markDefaultsStarted = () => {
    if (!calls.order.includes("defaults")) calls.order.push("defaults");
  };

  function conditionValues(condition: unknown): unknown[] {
    const values: unknown[] = [];
    const seen = new WeakSet<object>();
    const walk = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      if (seen.has(value)) return;
      seen.add(value);
      if (
        "value" in value &&
        !Array.isArray((value as { value?: unknown }).value)
      ) {
        values.push((value as { value?: unknown }).value);
      }
      for (const child of Object.values(value)) {
        if (Array.isArray(child)) {
          for (const item of child) walk(item);
        } else {
          walk(child);
        }
      }
    };
    walk(condition);
    return values;
  }

  function targetFromCondition(condition: unknown) {
    const values = conditionValues(condition);
    return targetIds.find((id) => values.includes(id));
  }

  class SelectBuilder {
    private table: unknown;
    private condition: unknown;

    constructor(private readonly selection: Record<string, unknown>) {}

    from(table: unknown) {
      this.table = table;
      return this;
    }

    where(condition: unknown) {
      this.condition = condition;
      return this;
    }

    limit(count: number) {
      return Promise.resolve(this.execute().slice(0, count));
    }

    // biome-ignore lint/suspicious/noThenProperty: Drizzle select doubles are awaitable.
    then(resolve: (value: unknown[]) => unknown) {
      return Promise.resolve(this.execute()).then(resolve);
    }

    private execute() {
      if (this.table === Unit) {
        if ("slug" in this.selection) {
          return state.units
            .filter((unit) => unit.slugScope === "scope-zone")
            .map((unit) => ({
              id: unit.id,
              slug: unit.slug ?? null,
              type: unit.type,
            }));
        }
        return state.units.map((unit) => ({ type: unit.type }));
      }
      if (this.table === Subscription) {
        const subscribedUnitId = targetFromCondition(this.condition);
        return state.subscriptions
          .filter(
            (subscription) =>
              subscription.subscriberUnitId === "root-user" &&
              subscription.subscribedUnitId === subscribedUnitId,
          )
          .map((subscription) => ({ id: subscription.id }));
      }
      if (this.table === UserSubscriptionListEntry) {
        const subscribedUnitId = targetFromCondition(this.condition);
        return state.entries
          .filter(
            (entry) =>
              entry.userUnitId === "root-user" &&
              entry.subscribedUnitId === subscribedUnitId,
          )
          .map((entry) => ({
            position: entry.position,
            state: entry.state,
          }));
      }
      return [];
    }
  }

  class InsertBuilder {
    private row: Record<string, unknown> = {};

    constructor(private readonly table: unknown) {}

    values(row: Record<string, unknown>) {
      this.row = row;
      return this;
    }

    onConflictDoNothing() {
      if (this.table === RealmMember) {
        markDefaultsStarted();
        state.realmMembers.push({
          realmUnitId: this.row.realmUnitId as string,
          userId: this.row.userId as string,
          roleKey: this.row.roleKey as string,
        });
      }
      return this;
    }

    onConflictDoUpdate(input: { set: Record<string, unknown> }) {
      if (this.table !== UserSubscriptionListEntry) return this;
      const existing = state.entries.find(
        (entry) =>
          entry.userUnitId === this.row.userUnitId &&
          entry.subscribedUnitId === this.row.subscribedUnitId,
      );
      if (existing) Object.assign(existing, input.set);
      return this;
    }

    returning() {
      this.execute();
      if (this.table !== UserSubscriptionListEntry) return Promise.resolve([]);
      return Promise.resolve(
        [
          state.entries.find(
            (entry) =>
              entry.userUnitId === this.row.userUnitId &&
              entry.subscribedUnitId === this.row.subscribedUnitId,
          ),
        ].filter(Boolean),
      );
    }

    // biome-ignore lint/suspicious/noThenProperty: Drizzle insert doubles are awaitable.
    then(resolve: (value: unknown[]) => unknown) {
      this.execute();
      return Promise.resolve([]).then(resolve);
    }

    private execute() {
      if (this.table === Subscription) {
        markDefaultsStarted();
        state.subscriptions.push({
          id: `sub-${state.subscriptions.length + 1}`,
          subscriberUnitId: this.row.subscriberUnitId as string,
          subscribedUnitId: this.row.subscribedUnitId as string,
          channels: this.row.channels as string[],
        });
        return;
      }

      if (this.table !== UserSubscriptionListEntry) return;
      markDefaultsStarted();
      const existing = state.entries.find(
        (entry) =>
          entry.userUnitId === this.row.userUnitId &&
          entry.subscribedUnitId === this.row.subscribedUnitId,
      );
      if (existing) return;
      state.entries.push({
        id: `entry-${state.entries.length + 1}`,
        userUnitId: this.row.userUnitId as string,
        subscribedUnitId: this.row.subscribedUnitId as string,
        subscribedType: this.row.subscribedType as "REALM" | "ZONE",
        position: this.row.position as string,
        pinned: false,
        state: this.row.state as "ACTIVE" | "REMOVED",
      });
    }
  }

  return {
    state,
    select(selection: Record<string, unknown>) {
      return new SelectBuilder(selection);
    },
    insert(table: unknown) {
      return new InsertBuilder(table);
    },
    update(_table: unknown) {
      return {
        set() {
          return { where: () => undefined };
        },
      };
    },
  };
}
