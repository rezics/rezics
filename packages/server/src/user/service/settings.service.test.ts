import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  User,
  UserContentRatingPreference,
  UserNotificationPreference,
  UserPreference,
  UserPreferredLanguage,
  UserPrivacyPreference,
  UserRealmTagDisplayPreference,
  UserRealmTagDisplayRealm,
  UserSubscriptionListPreference,
} from "../../db/schema";

type Row = Record<string, any>;

const state = new Map<unknown, Row[]>();

function rows(table: unknown): Row[] {
  const value = state.get(table);
  if (value) return value;
  const created: Row[] = [];
  state.set(table, created);
  return created;
}

function resetState() {
  state.clear();
  state.set(User, [{ unitId: "user-1" }]);
}

function rowKey(table: unknown, row: Row): string {
  if (table === UserPreference) return row.userId;
  if (table === UserPreferredLanguage) return `${row.userId}:${row.language}`;
  if (table === UserContentRatingPreference)
    return `${row.userId}:${row.rating}`;
  if (table === UserSubscriptionListPreference)
    return `${row.userId}:${row.list}`;
  if (table === UserNotificationPreference) {
    return `${row.userId}:${row.kind}:${row.channel}`;
  }
  if (table === UserPrivacyPreference) return `${row.userId}:${row.field}`;
  if (table === UserRealmTagDisplayPreference) {
    return `${row.userId}:${row.targetKey}`;
  }
  if (table === UserRealmTagDisplayRealm) {
    return `${row.preferenceId}:${row.realmId}`;
  }
  return JSON.stringify(row);
}

class SelectBuilder {
  private table: unknown;
  private take?: number;

  from(table: unknown) {
    this.table = table;
    return this;
  }

  where() {
    return this;
  }

  orderBy() {
    return this;
  }

  limit(take: number) {
    this.take = take;
    return this;
  }

  // biome-ignore lint/suspicious/noThenProperty: this mock intentionally implements Drizzle's thenable query builder contract.
  then(resolve: (value: Row[]) => unknown) {
    let result = [...rows(this.table)];
    if (
      this.table === UserPreferredLanguage ||
      this.table === UserRealmTagDisplayRealm
    ) {
      result = result.sort((a, b) => a.position - b.position);
    }
    if (this.take !== undefined) result = result.slice(0, this.take);
    return Promise.resolve(result).then(resolve);
  }
}

class InsertBuilder {
  private input: Row | Row[] = [];
  private executed = false;
  private inserted: Row[] = [];

  constructor(private readonly table: unknown) {}

  values(input: Row | Row[]) {
    this.input = input;
    return this;
  }

  onConflictDoUpdate() {
    this.execute(true);
    return this;
  }

  returning() {
    this.execute(false);
    return Promise.resolve(
      this.inserted.map((row) => ({ id: row.id })).filter((row) => row.id),
    );
  }

  // biome-ignore lint/suspicious/noThenProperty: this mock intentionally implements Drizzle's thenable query builder contract.
  then(resolve: (value: Row[]) => unknown) {
    this.execute(false);
    return Promise.resolve([]).then(resolve);
  }

  private execute(upsert: boolean) {
    if (this.executed) return;
    this.executed = true;
    const tableRows = rows(this.table);
    const inputRows = Array.isArray(this.input) ? this.input : [this.input];
    for (const raw of inputRows) {
      const row = {
        ...raw,
        ...(this.table === UserRealmTagDisplayPreference
          ? { id: raw.id ?? `pref-${tableRows.length + 1}` }
          : {}),
      };
      const key = rowKey(this.table, row);
      const index = tableRows.findIndex(
        (existing) => rowKey(this.table, existing) === key,
      );
      if (upsert && index >= 0) {
        tableRows[index] = { ...tableRows[index], ...row };
        this.inserted.push(tableRows[index]);
      } else {
        tableRows.push(row);
        this.inserted.push(row);
      }
    }
  }
}

class DeleteBuilder {
  constructor(private readonly table: unknown) {}

  where() {
    return this;
  }

  // biome-ignore lint/suspicious/noThenProperty: this mock intentionally implements Drizzle's thenable query builder contract.
  then(resolve: (value: Row[]) => unknown) {
    if (this.table === UserRealmTagDisplayPreference) {
      state.set(UserRealmTagDisplayRealm, []);
    }
    state.set(this.table, []);
    return Promise.resolve([]).then(resolve);
  }
}

const db = {
  select: () => new SelectBuilder(),
  insert: (table: unknown) => new InsertBuilder(table),
  delete: (table: unknown) => new DeleteBuilder(table),
  transaction: async (fn: (tx: typeof db) => Promise<void>) => fn(db),
};

mock.module("../../db/client", () => ({ db }));

beforeEach(() => {
  resetState();
});

describe("settings preferences", () => {
  test("normalizes empty settings to the fallback language", async () => {
    const { getSettings } = await import("./settings.service");

    await expect(getSettings("user-1")).resolves.toMatchObject({
      preferredLanguages: ["en"],
    });
  });

  test("normalizes and replaces preferred languages", async () => {
    const { updateSettings } = await import("./settings.service");

    const result = await updateSettings("user-1", {
      preferredLanguages: ["JA", "ja", "en"],
    } as never);

    expect(result.preferredLanguages).toEqual(["ja", "en"]);
    expect(rows(UserPreferredLanguage)).toMatchObject([
      { userId: "user-1", language: "ja", position: 0 },
      { userId: "user-1", language: "en", position: 1 },
    ]);
  });

  test("persists keyed preference groups into normalized rows", async () => {
    const { updateSettings } = await import("./settings.service");

    const result = await updateSettings("user-1", {
      content: { optedInRatings: ["R_18"] },
      notifications: { follow: false, reply: true },
      privacy: { userTags: "followers" },
      publishing: { defaultLicenseSlug: "cc0-1.0" },
      subscriptionLists: { zones: { defaultSort: "addedDesc" } },
    });

    expect(result).toMatchObject({
      content: { optedInRatings: ["R_18"] },
      notifications: { follow: false, reply: true },
      privacy: { userTags: "followers" },
      publishing: { defaultLicenseSlug: "cc0-1.0" },
      subscriptionLists: { zones: { defaultSort: "addedDesc" } },
    });
  });

  test("stores realm tag display caps as nullable limits", async () => {
    const { updateSettings } = await import("./settings.service");

    const result = await updateSettings("user-1", {
      realmTagPreferences: {
        BOOK: {
          realmIds: [
            "00000000-0000-0000-0000-000000000002",
            "00000000-0000-0000-0000-000000000001",
          ],
        },
      },
    });

    expect(result.realmTagPreferences?.BOOK).toEqual({
      realmIds: [
        "00000000-0000-0000-0000-000000000002",
        "00000000-0000-0000-0000-000000000001",
      ],
      maxDisplay: undefined,
    });
    expect(rows(UserRealmTagDisplayPreference)[0]).toMatchObject({
      targetKey: "BOOK",
      maxVisibleTags: null,
    });
    expect(rows(UserRealmTagDisplayRealm)).toMatchObject([
      { realmId: "00000000-0000-0000-0000-000000000002", position: 0 },
      { realmId: "00000000-0000-0000-0000-000000000001", position: 1 },
    ]);
  });
});
