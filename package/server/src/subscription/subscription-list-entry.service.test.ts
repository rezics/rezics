import { describe, expect, test } from "bun:test";
import {
  Realm,
  RealmMember,
  Subscription,
  Unit,
  User,
  UserSubscriptionListEntry,
} from "../db/schema";
import { SubscriptionListEntryService } from "./subscription-list-entry.service";

const USER_UNIT_ID = "user-1";
const TARGET_UNIT_ID = "zone-1";
const NOW = new Date("2026-06-09T00:00:00.000Z");

type MemoryEntry = typeof UserSubscriptionListEntry.$inferSelect & {
  subscribedSlug?: string | null;
  subscribedTitle?: string | null;
};

function entry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: overrides.id ?? `entry-${overrides.subscribedUnitId ?? TARGET_UNIT_ID}`,
    userUnitId: USER_UNIT_ID,
    subscribedUnitId: TARGET_UNIT_ID,
    subscribedType: "ZONE",
    position: "m",
    pinned: false,
    state: "ACTIVE",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function createMemoryDb(input: {
  units?: Array<{
    id: string;
    type: string;
    slug?: string | null;
    subscriberCount?: number;
  }>;
  translations?: Array<{
    unitId: string;
    language: string;
    title: string | null;
  }>;
  supportLanguages?: Array<{
    unitId: string;
    language: string;
    isPrimary?: boolean | null;
    position?: string | null;
  }>;
  entries?: MemoryEntry[];
  subscriptions?: Array<{
    id: string;
    subscriberUnitId: string;
    subscribedUnitId: string;
    channels: string[];
  }>;
  realms?: Array<{ unitId: string; isPublic: boolean }>;
  realmMembers?: Array<{ realmUnitId: string; userId: string }>;
}) {
  const state = {
    units: input.units ?? [
      { id: TARGET_UNIT_ID, type: "ZONE", slug: "target", subscriberCount: 0 },
    ],
    translations: input.translations ?? [],
    supportLanguages: input.supportLanguages ?? [],
    entries: input.entries ?? [],
    subscriptions: input.subscriptions ?? [],
    realms: input.realms ?? [],
    realmMembers: input.realmMembers ?? [],
    userCounterUpdates: 0,
  };

  class SelectBuilder {
    private table: unknown;
    private limitCount: number | null = null;
    private offsetCount = 0;

    constructor(private readonly selection: Record<string, unknown> = {}) {}

    from(table: unknown) {
      this.table = table;
      return this;
    }

    innerJoin() {
      return this;
    }

    leftJoin() {
      return this;
    }

    where() {
      return this;
    }

    orderBy() {
      return this;
    }

    offset(count: number) {
      this.offsetCount = count;
      return this;
    }

    limit(count: number) {
      this.limitCount = count;
      return Promise.resolve(this.execute());
    }

    // biome-ignore lint/suspicious/noThenProperty: Drizzle test double must be awaitable.
    then(
      resolve: (value: unknown) => unknown,
      reject: (error: unknown) => unknown,
    ) {
      return Promise.resolve(this.execute()).then(resolve, reject);
    }

    private execute() {
      let rows: unknown[] = [];

      if (this.table === Unit) {
        rows = state.units.map((unit) => ({
          id: unit.id,
          type: unit.type,
          subscriberCount: unit.subscriberCount ?? 0,
          slug: unit.slug ?? null,
        }));
      } else if (this.table === Realm) {
        rows = state.realms.map((realm) => ({ isPublic: realm.isPublic }));
      } else if (this.table === RealmMember) {
        rows = state.realmMembers.map((member) => ({
          realmUnitId: member.realmUnitId,
        }));
      } else if (this.table === Subscription) {
        rows = state.subscriptions.map((subscription) => ({
          id: subscription.id,
        }));
      } else if (this.table === UserSubscriptionListEntry) {
        if ("total" in this.selection) {
          rows = [{ total: state.entries.length }];
        } else if ("entry" in this.selection) {
          rows = state.entries
            .slice()
            .sort((a, b) => {
              if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
              const byPosition = a.position.localeCompare(b.position);
              if (byPosition !== 0) return byPosition;
              return a.createdAt.getTime() - b.createdAt.getTime();
            })
            .map((row) => ({
              entry: row,
              subscribedSlug:
                state.units.find((unit) => unit.id === row.subscribedUnitId)
                  ?.slug ?? null,
            }));
        } else if ("subscribedUnitId" in this.selection) {
          rows = state.entries.flatMap((row) => {
            const translations = state.translations.filter(
              (translation) => translation.unitId === row.subscribedUnitId,
            );
            const supportLanguages = state.supportLanguages.filter(
              (language) => language.unitId === row.subscribedUnitId,
            );
            const translationRows = translations.length
              ? translations
              : [
                  {
                    unitId: row.subscribedUnitId,
                    language: null,
                    title: row.subscribedTitle ?? null,
                  },
                ];
            const supportRows = supportLanguages.length
              ? supportLanguages
              : [
                  {
                    unitId: row.subscribedUnitId,
                    language: null,
                    isPrimary: null,
                    position: null,
                  },
                ];
            return translationRows.flatMap((translation) =>
              supportRows.map((supportLanguage) => ({
                subscribedUnitId: row.subscribedUnitId,
                subscribedLanguage: translation.language,
                subscribedTitle: translation.title,
                supportLanguage: supportLanguage.language,
                supportLanguageIsPrimary: supportLanguage.isPrimary ?? null,
                supportLanguagePosition: supportLanguage.position ?? null,
              })),
            );
          });
        } else if ("position" in this.selection && "state" in this.selection) {
          rows = state.entries.map((row) => ({
            position: row.position,
            state: row.state,
          }));
        } else if ("position" in this.selection) {
          rows = state.entries
            .filter((row) => row.state === "ACTIVE")
            .slice()
            .sort((a, b) => b.position.localeCompare(a.position))
            .map((row) => ({ position: row.position }));
        }
      }

      const offsetRows = rows.slice(this.offsetCount);
      return this.limitCount == null
        ? offsetRows
        : offsetRows.slice(0, this.limitCount);
    }
  }

  class InsertBuilder {
    private row: Record<string, unknown> = {};
    private conflictSet: Record<string, unknown> | null = null;

    constructor(private readonly table: unknown) {}

    values(row: Record<string, unknown>) {
      this.row = row;
      return this;
    }

    onConflictDoUpdate(input: { set: Record<string, unknown> }) {
      this.conflictSet = input.set;
      return this;
    }

    returning() {
      return Promise.resolve(this.executeReturning());
    }

    // biome-ignore lint/suspicious/noThenProperty: Drizzle test double must be awaitable.
    then(
      resolve: (value: unknown) => unknown,
      reject: (error: unknown) => unknown,
    ) {
      return Promise.resolve(this.execute()).then(resolve, reject);
    }

    private executeReturning() {
      this.execute();
      if (this.table === UserSubscriptionListEntry) {
        return [
          state.entries.find(
            (row) =>
              row.userUnitId === this.row.userUnitId &&
              row.subscribedUnitId === this.row.subscribedUnitId,
          ),
        ].filter(Boolean);
      }
      return [];
    }

    private execute() {
      if (this.table === Subscription) {
        state.subscriptions.push({
          id: `sub-${state.subscriptions.length + 1}`,
          subscriberUnitId: this.row.subscriberUnitId as string,
          subscribedUnitId: this.row.subscribedUnitId as string,
          channels: this.row.channels as string[],
        });
        return;
      }

      if (this.table !== UserSubscriptionListEntry) return;
      const existing = state.entries.find(
        (row) =>
          row.userUnitId === this.row.userUnitId &&
          row.subscribedUnitId === this.row.subscribedUnitId,
      );
      if (existing) {
        Object.assign(existing, this.conflictSet ?? this.row, {
          updatedAt: this.row.updatedAt ?? NOW,
        });
        return;
      }
      state.entries.push(
        entry({
          id: `entry-${state.entries.length + 1}`,
          userUnitId: this.row.userUnitId as string,
          subscribedUnitId: this.row.subscribedUnitId as string,
          subscribedType: this.row
            .subscribedType as MemoryEntry["subscribedType"],
          position: this.row.position as string,
          state: this.row.state as MemoryEntry["state"],
          pinned: false,
          updatedAt: (this.row.updatedAt as Date | undefined) ?? NOW,
        }),
      );
    }
  }

  class UpdateBuilder {
    private patch: Record<string, unknown> = {};

    constructor(private readonly table: unknown) {}

    set(patch: Record<string, unknown>) {
      this.patch = patch;
      return this;
    }

    where() {
      return this;
    }

    returning() {
      return Promise.resolve(this.executeReturning());
    }

    // biome-ignore lint/suspicious/noThenProperty: Drizzle test double must be awaitable.
    then(
      resolve: (value: unknown) => unknown,
      reject: (error: unknown) => unknown,
    ) {
      return Promise.resolve(this.execute()).then(resolve, reject);
    }

    private executeReturning() {
      const row = this.execute();
      return row ? [row] : [];
    }

    private execute() {
      if (this.table === UserSubscriptionListEntry) {
        const row =
          state.entries.find((candidate) => candidate.state === "ACTIVE") ??
          state.entries[0];
        if (!row) return undefined;
        Object.assign(row, this.patch);
        return row;
      }

      if (this.table === Unit) {
        const unit = state.units[0];
        if (unit) unit.subscriberCount = (unit.subscriberCount ?? 0) + 1;
      }

      if (this.table === User) {
        state.userCounterUpdates += 1;
      }

      return undefined;
    }
  }

  const db = {
    state,
    select: (selection?: Record<string, unknown>) =>
      new SelectBuilder(selection),
    insert: (table: unknown) => new InsertBuilder(table),
    update: (table: unknown) => new UpdateBuilder(table),
    transaction: async (callback: (tx: unknown) => unknown) => callback(db),
  };

  return db;
}

function createService(db: ReturnType<typeof createMemoryDb>) {
  return new SubscriptionListEntryService(async () => db);
}

describe("SubscriptionListEntryService", () => {
  test("resolves sidebar titles through the read-language candidate chain", async () => {
    const db = createMemoryDb({
      entries: [entry({ subscribedUnitId: TARGET_UNIT_ID })],
      translations: [
        { unitId: TARGET_UNIT_ID, language: "en", title: "English Zone" },
        { unitId: TARGET_UNIT_ID, language: "ja", title: "日本語ゾーン" },
        { unitId: TARGET_UNIT_ID, language: "zh-hant", title: "繁體專區" },
      ],
      supportLanguages: [
        {
          unitId: TARGET_UNIT_ID,
          language: "en",
          isPrimary: false,
          position: "b",
        },
        {
          unitId: TARGET_UNIT_ID,
          language: "ja",
          isPrimary: false,
          position: "c",
        },
        {
          unitId: TARGET_UNIT_ID,
          language: "zh-hant",
          isPrimary: true,
          position: "a",
        },
      ],
    });

    const { entries: rows } = await createService(db).list({
      userUnitId: USER_UNIT_ID,
      subscribedType: "ZONE",
      preferredLanguages: ["zh-hant", "en"],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.subscribedTitle).toBe("繁體專區");
  });

  test("pin and reorder update only active list metadata", async () => {
    const db = createMemoryDb({
      entries: [entry({ subscribedUnitId: TARGET_UNIT_ID })],
      subscriptions: [
        {
          id: "sub-1",
          subscriberUnitId: USER_UNIT_ID,
          subscribedUnitId: TARGET_UNIT_ID,
          channels: ["*"],
        },
      ],
    });
    const service = createService(db);

    await service.pin({
      userUnitId: USER_UNIT_ID,
      subscribedUnitId: TARGET_UNIT_ID,
      pinned: true,
    });
    await service.reorder({
      userUnitId: USER_UNIT_ID,
      subscribedUnitId: TARGET_UNIT_ID,
      position: "a0",
    });

    expect(db.state.entries[0]).toMatchObject({
      pinned: true,
      position: "a0",
      state: "ACTIVE",
    });
    expect(db.state.subscriptions).toHaveLength(1);
  });

  test("activate appends a new active entry after the current manual order", async () => {
    const db = createMemoryDb({
      units: [
        { id: TARGET_UNIT_ID, type: "ZONE", slug: "target" },
        { id: "zone-2", type: "ZONE", slug: "second" },
        { id: "zone-3", type: "ZONE", slug: "third" },
      ],
      entries: [
        entry({
          subscribedUnitId: "removed-zone",
          position: "z",
          state: "REMOVED",
        }),
        entry({ subscribedUnitId: TARGET_UNIT_ID, position: "a" }),
        entry({ subscribedUnitId: "zone-2", position: "c" }),
      ],
    });

    const dto = await createService(db).activate({
      userUnitId: USER_UNIT_ID,
      subscribedUnitId: "zone-3",
    });

    expect(dto.position > "c").toBe(true);
    expect(dto.state).toBe("ACTIVE");
  });

  test("markRemoved keeps the subscription row but removes the sidebar entry", async () => {
    const db = createMemoryDb({
      entries: [entry({ pinned: true })],
      subscriptions: [
        {
          id: "sub-1",
          subscriberUnitId: USER_UNIT_ID,
          subscribedUnitId: TARGET_UNIT_ID,
          channels: ["*"],
        },
      ],
    });

    await createService(db).markRemoved({
      userUnitId: USER_UNIT_ID,
      subscribedUnitId: TARGET_UNIT_ID,
    });

    expect(db.state.entries[0]).toMatchObject({
      state: "REMOVED",
      pinned: false,
    });
    expect(db.state.subscriptions).toHaveLength(1);
  });

  test("recover reactivates an existing subscription without bumping counters", async () => {
    const db = createMemoryDb({
      entries: [entry({ state: "REMOVED", position: "c" })],
      subscriptions: [
        {
          id: "sub-1",
          subscriberUnitId: USER_UNIT_ID,
          subscribedUnitId: TARGET_UNIT_ID,
          channels: ["*"],
        },
      ],
    });

    const dto = await createService(db).recover({
      userUnitId: USER_UNIT_ID,
      subscribedUnitId: TARGET_UNIT_ID,
    });

    expect(dto.state).toBe("ACTIVE");
    expect(db.state.subscriptions).toHaveLength(1);
    expect(db.state.units[0]?.subscriberCount).toBe(0);
  });

  test("recover recreates a missing subscription and activates the entry", async () => {
    const db = createMemoryDb({
      entries: [entry({ state: "REMOVED" })],
      subscriptions: [],
    });

    await createService(db).recover({
      userUnitId: USER_UNIT_ID,
      subscribedUnitId: TARGET_UNIT_ID,
    });

    expect(db.state.entries[0]?.state).toBe("ACTIVE");
    expect(db.state.subscriptions).toHaveLength(1);
    expect(db.state.units[0]?.subscriberCount).toBe(1);
  });

  test("recover is best-effort when the target Unit is missing", async () => {
    const db = createMemoryDb({
      units: [],
      entries: [entry({ state: "REMOVED" })],
      subscriptions: [],
    });

    await expect(
      createService(db).recover({
        userUnitId: USER_UNIT_ID,
        subscribedUnitId: TARGET_UNIT_ID,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.state.entries[0]?.state).toBe("REMOVED");
    expect(db.state.subscriptions).toHaveLength(0);
  });

  test("recover rejects unsubscribable targets without changing list state", async () => {
    const db = createMemoryDb({
      units: [{ id: TARGET_UNIT_ID, type: "LABEL", subscriberCount: 0 }],
      entries: [entry({ state: "REMOVED", subscribedType: "LABEL" })],
      subscriptions: [],
    });

    await expect(
      createService(db).recover({
        userUnitId: USER_UNIT_ID,
        subscribedUnitId: TARGET_UNIT_ID,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(db.state.entries[0]?.state).toBe("REMOVED");
    expect(db.state.subscriptions).toHaveLength(0);
  });

  test("recover rejects private realms without membership", async () => {
    const db = createMemoryDb({
      units: [{ id: TARGET_UNIT_ID, type: "REALM", subscriberCount: 0 }],
      entries: [entry({ state: "REMOVED", subscribedType: "REALM" })],
      subscriptions: [],
      realms: [{ unitId: TARGET_UNIT_ID, isPublic: false }],
      realmMembers: [],
    });

    await expect(
      createService(db).recover({
        userUnitId: USER_UNIT_ID,
        subscribedUnitId: TARGET_UNIT_ID,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.state.entries[0]?.state).toBe("REMOVED");
    expect(db.state.subscriptions).toHaveLength(0);
  });
});
