import { describe, expect, test } from "bun:test";
import {
  RealmMember,
  Subscription,
  Unit,
  UserSubscriptionListEntry,
} from "../../db/schema";
import {
  ensureRegistrationDefaultSubscriptions,
  REGISTRATION_DEFAULT_SUBSCRIPTIONS,
} from "./registration-defaults";

const USER = "user-1";
const DEFAULT_REALM = "realm-rezics";
const ZONE_SCOPE = "zone-scope";

interface MemoryUnit {
  id: string;
  type: string;
  slug?: string | null;
  slugScope?: string | null;
  subscriberCount: number;
}

interface MemorySubscription {
  id: string;
  subscriberUnitId: string;
  subscribedUnitId: string;
  channels: string[];
}

interface MemoryEntry {
  id: string;
  userUnitId: string;
  subscribedUnitId: string;
  subscribedType: "REALM" | "ZONE";
  position: string;
  pinned: boolean;
  state: "ACTIVE" | "REMOVED";
}

function createMemoryDb(input: {
  units?: MemoryUnit[];
  subscriptions?: MemorySubscription[];
  entries?: MemoryEntry[];
  realmMembers?: Array<{
    realmUnitId: string;
    userId: string;
    roleKey: string;
  }>;
}) {
  const state = {
    units: input.units ?? [
      {
        id: DEFAULT_REALM,
        type: "REALM",
        subscriberCount: 0,
      },
      {
        id: "zone-book",
        type: "ZONE",
        slug: "book",
        slugScope: ZONE_SCOPE,
        subscriberCount: 0,
      },
      {
        id: "zone-realms",
        type: "ZONE",
        slug: "realms",
        slugScope: ZONE_SCOPE,
        subscriberCount: 0,
      },
      {
        id: "zone-popular",
        type: "ZONE",
        slug: "popular",
        slugScope: ZONE_SCOPE,
        subscriberCount: 0,
      },
    ],
    subscriptions: input.subscriptions ?? [],
    entries: input.entries ?? [],
    realmMembers: input.realmMembers ?? [],
    defaultTargetIds: [
      DEFAULT_REALM,
      "zone-book",
      "zone-realms",
      "zone-popular",
    ],
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
    return state.defaultTargetIds.find((id) => values.includes(id));
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
    then(
      resolve: (value: unknown[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return Promise.resolve(this.execute()).then(resolve, reject);
    }

    private execute() {
      if (this.table === Unit) {
        if ("slug" in this.selection) {
          return state.units
            .filter((unit) => unit.slugScope === ZONE_SCOPE)
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
              subscription.subscriberUnitId === USER &&
              subscription.subscribedUnitId === subscribedUnitId,
          )
          .map((subscription) => ({ id: subscription.id }));
      }
      if (this.table === UserSubscriptionListEntry) {
        const subscribedUnitId = targetFromCondition(this.condition);
        return state.entries
          .filter(
            (entry) =>
              entry.userUnitId === USER &&
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
        const exists = state.realmMembers.some(
          (member) =>
            member.realmUnitId === this.row.realmUnitId &&
            member.userId === this.row.userId,
        );
        if (!exists) {
          state.realmMembers.push({
            realmUnitId: this.row.realmUnitId as string,
            userId: this.row.userId as string,
            roleKey: this.row.roleKey as string,
          });
        }
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
    then(
      resolve: (value: unknown[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      this.execute();
      return Promise.resolve([]).then(resolve, reject);
    }

    private execute() {
      if (this.table === Subscription) {
        const exists = state.subscriptions.some(
          (subscription) =>
            subscription.subscriberUnitId === this.row.subscriberUnitId &&
            subscription.subscribedUnitId === this.row.subscribedUnitId,
        );
        if (!exists) {
          state.subscriptions.push({
            id: `sub-${state.subscriptions.length + 1}`,
            subscriberUnitId: this.row.subscriberUnitId as string,
            subscribedUnitId: this.row.subscribedUnitId as string,
            channels: this.row.channels as string[],
          });
        }
        return;
      }

      if (this.table !== UserSubscriptionListEntry) return;
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

  class UpdateBuilder {
    constructor(private readonly table: unknown) {}

    set(_patch: Record<string, unknown>) {
      return this;
    }

    where(condition: unknown) {
      if (this.table === Unit) {
        const targetId = targetFromCondition(condition);
        const target = state.units.find((unit) => unit.id === targetId);
        if (target) target.subscriberCount += 1;
      }
      return this;
    }

    // biome-ignore lint/suspicious/noThenProperty: Drizzle update doubles are awaitable.
    then(
      resolve: (value: unknown[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return Promise.resolve([]).then(resolve, reject);
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
    update(table: unknown) {
      return new UpdateBuilder(table);
    },
  };
}

describe("ensureRegistrationDefaultSubscriptions", () => {
  test("subscribes new users to the default realm and official zones in deterministic order", async () => {
    const db = createMemoryDb({});

    await ensureRegistrationDefaultSubscriptions(db, USER, {
      defaultRealmUnitId: DEFAULT_REALM,
      zoneSlugScopeId: ZONE_SCOPE,
    });

    expect(db.state.realmMembers).toEqual([
      { realmUnitId: DEFAULT_REALM, userId: USER, roleKey: "member" },
    ]);
    expect(
      db.state.subscriptions.map((subscription) => ({
        subscribedUnitId: subscription.subscribedUnitId,
        channels: subscription.channels,
      })),
    ).toEqual([
      { subscribedUnitId: DEFAULT_REALM, channels: ["*"] },
      { subscribedUnitId: "zone-book", channels: ["*"] },
      { subscribedUnitId: "zone-realms", channels: ["*"] },
      { subscribedUnitId: "zone-popular", channels: ["*"] },
    ]);
    expect(
      db.state.entries.map((entry) => ({
        subscribedUnitId: entry.subscribedUnitId,
        subscribedType: entry.subscribedType,
        state: entry.state,
      })),
    ).toEqual([
      {
        subscribedUnitId: DEFAULT_REALM,
        subscribedType: "REALM",
        state: "ACTIVE",
      },
      {
        subscribedUnitId: "zone-book",
        subscribedType: "ZONE",
        state: "ACTIVE",
      },
      {
        subscribedUnitId: "zone-realms",
        subscribedType: "ZONE",
        state: "ACTIVE",
      },
      {
        subscribedUnitId: "zone-popular",
        subscribedType: "ZONE",
        state: "ACTIVE",
      },
    ]);
    expect(db.state.entries.map((entry) => entry.position)).toEqual(
      [...db.state.entries.map((entry) => entry.position)].sort(),
    );
  });

  test("is idempotent for users who repeat completion with existing active entries", async () => {
    const db = createMemoryDb({
      subscriptions: [
        {
          id: "existing-sub",
          subscriberUnitId: USER,
          subscribedUnitId: "zone-book",
          channels: ["*"],
        },
      ],
      entries: [
        {
          id: "existing-entry",
          userUnitId: USER,
          subscribedUnitId: "zone-book",
          subscribedType: "ZONE",
          position: "custom-position",
          pinned: true,
          state: "ACTIVE",
        },
      ],
    });

    await ensureRegistrationDefaultSubscriptions(db, USER, {
      defaultRealmUnitId: DEFAULT_REALM,
      zoneSlugScopeId: ZONE_SCOPE,
    });
    await ensureRegistrationDefaultSubscriptions(db, USER, {
      defaultRealmUnitId: DEFAULT_REALM,
      zoneSlugScopeId: ZONE_SCOPE,
    });

    expect(
      db.state.subscriptions.filter(
        (subscription) => subscription.subscribedUnitId === "zone-book",
      ),
    ).toHaveLength(1);
    expect(
      db.state.entries.filter(
        (entry) => entry.subscribedUnitId === "zone-book",
      ),
    ).toEqual([
      expect.objectContaining({
        position: "custom-position",
        pinned: true,
        state: "ACTIVE",
      }),
    ]);
  });

  test("reactivates removed default entries without duplicating existing subscriptions", async () => {
    const db = createMemoryDb({
      subscriptions: [
        {
          id: "existing-sub",
          subscriberUnitId: USER,
          subscribedUnitId: "zone-book",
          channels: ["*"],
        },
      ],
      entries: [
        {
          id: "removed-entry",
          userUnitId: USER,
          subscribedUnitId: "zone-book",
          subscribedType: "ZONE",
          position: "old",
          pinned: false,
          state: "REMOVED",
        },
      ],
    });

    await ensureRegistrationDefaultSubscriptions(db, USER, {
      defaultRealmUnitId: DEFAULT_REALM,
      zoneSlugScopeId: ZONE_SCOPE,
    });

    expect(
      db.state.subscriptions.filter(
        (subscription) => subscription.subscribedUnitId === "zone-book",
      ),
    ).toHaveLength(1);
    expect(
      db.state.entries.find((entry) => entry.subscribedUnitId === "zone-book"),
    ).toMatchObject({ state: "ACTIVE", subscribedType: "ZONE" });
  });

  test("exposes the server-owned registration default registry without Home", () => {
    expect(REGISTRATION_DEFAULT_SUBSCRIPTIONS).toEqual([
      { key: "realm:rezics", subscribedType: "REALM" },
      { key: "zone:book", subscribedType: "ZONE", slug: "book" },
      { key: "zone:realms", subscribedType: "ZONE", slug: "realms" },
      { key: "zone:popular", subscribedType: "ZONE", slug: "popular" },
    ]);
  });
});
