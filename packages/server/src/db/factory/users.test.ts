import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  RealmMember,
  Subscription,
  Unit,
  User,
  UserSubscriptionListEntry,
} from "../schema";

const seedAuthUserMock = mock(
  async (input: { email: string; name: string }) => ({
    userId: `unit-${input.email}`,
    email: input.email,
    name: input.name,
  }),
);
const bootstrapSystemShelvesMock = mock(async () => {});

mock.module("../../../../backend/src/auth/seed/seed-auth-user", () => ({
  seedAuthUser: seedAuthUserMock,
}));

mock.module("./system-shelves.js", () => ({
  bootstrapSystemShelves: bootstrapSystemShelvesMock,
  createDrizzleSystemShelfClient: (db: unknown) => ({ db }),
}));

function createDbStub() {
  const state = {
    units: [
      {
        id: "realm-rezics",
        type: "REALM",
        slug: "rezics",
        slugScope: "scope-realm",
        subscriberCount: 0,
      },
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
      {
        id: "zone-zones",
        type: "ZONE",
        slug: "zones",
        slugScope: "scope-zone",
        subscriberCount: 0,
      },
    ] as Array<{
      id: string;
      type: string;
      slug?: string | null;
      slugScope?: string | null;
      subscriberCount: number;
    }>,
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
    users: [] as string[],
  };

  const targetIds = [
    "realm-rezics",
    "zone-book",
    "zone-realms",
    "zone-zones",
    "zone-popular",
  ];

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

  function userFromCondition(condition: unknown) {
    const values = conditionValues(condition);
    return state.users.find((id) => values.includes(id));
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

    // biome-ignore lint/suspicious/noThenProperty: this mock intentionally implements Drizzle's thenable query builder contract.
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
        const values = conditionValues(this.condition);
        if (values.includes("scope-realm") && values.includes("rezics")) {
          return [{ id: "realm-rezics", type: "REALM" }];
        }
        const targetId = targetFromCondition(this.condition);
        const target = state.units.find((unit) => unit.id === targetId);
        return target ? [{ type: target.type }] : [];
      }
      if (this.table === Subscription) {
        const userUnitId = userFromCondition(this.condition);
        const subscribedUnitId = targetFromCondition(this.condition);
        return state.subscriptions
          .filter(
            (subscription) =>
              subscription.subscriberUnitId === userUnitId &&
              subscription.subscribedUnitId === subscribedUnitId,
          )
          .map((subscription) => ({ id: subscription.id }));
      }
      if (this.table === UserSubscriptionListEntry) {
        const userUnitId = userFromCondition(this.condition);
        const subscribedUnitId = targetFromCondition(this.condition);
        return state.entries
          .filter(
            (entry) =>
              entry.userUnitId === userUnitId &&
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
      this.execute();
      return this;
    }

    onConflictDoUpdate() {
      return this;
    }

    onConflictDoNothing() {
      return this;
    }

    returning() {
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

    // biome-ignore lint/suspicious/noThenProperty: this mock intentionally implements Drizzle's thenable query builder contract.
    then(resolve: (value: unknown[]) => unknown) {
      return Promise.resolve([]).then(resolve);
    }

    private execute() {
      if (this.table === Unit) {
        state.units.push({
          id: this.row.id as string,
          type: this.row.type as string,
          slug: this.row.slug as string | null,
          slugScope: this.row.slugScope as string | null,
          subscriberCount: 0,
        });
        return;
      }
      if (this.table === User) {
        state.users.push(this.row.unitId as string);
        return;
      }
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
        return;
      }
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

  const db = {
    state,
    insert: mock((table: unknown) => new InsertBuilder(table)),
    select: mock(
      (selection: Record<string, unknown>) => new SelectBuilder(selection),
    ),
    update: mock(() => ({
      set() {
        return { where: () => undefined };
      },
    })),
  };

  return db;
}

function createAuthDbStub() {
  return {
    select: mock(() => ({
      from() {
        return {
          where: mock(async () => []),
        };
      },
    })),
    transaction: mock(async () => {}),
  };
}

describe("factory seedUsers", () => {
  beforeEach(() => {
    seedAuthUserMock.mockClear();
    bootstrapSystemShelvesMock.mockClear();
  });

  test("applies registration defaults to factory-created users when infra targets exist", async () => {
    const { seedUsers } = await import("./users");
    const db = createDbStub();
    const ctx = {
      authDb: { db: createAuthDbStub() },
      db,
      draw: () => 1,
      slugScopes: {
        user: "scope-user",
        realm: "scope-realm",
        zone: "scope-zone",
      },
      sync: { user: mock(async () => {}) },
    };

    await seedUsers(ctx as never, { target: 1 } as never);

    expect(
      db.state.entries.filter((entry) => entry.subscribedType === "REALM"),
    ).toHaveLength(2);
    expect(
      db.state.entries.filter((entry) => entry.subscribedType === "ZONE"),
    ).toHaveLength(8);
    expect(db.state.realmMembers.map((member) => member.realmUnitId)).toEqual([
      "realm-rezics",
      "realm-rezics",
    ]);
    expect(
      db.state.entries.some((entry) =>
        entry.userUnitId.startsWith("unit-factory-admin"),
      ),
    ).toBe(true);
  });
});

afterAll(() => {
  mock.restore();
});
