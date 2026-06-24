import { describe, expect, mock, test } from "bun:test";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";

async function loadSearchHarness() {
  mock.restore();
  const [{ setSearchDb }, { createSearchHandlers }] = await Promise.all([
    import("@rezics/search/sync"),
    import("./handlers"),
  ]);
  return { createSearchHandlers, setSearchDb };
}

function createDb(rowSets: unknown[][]) {
  const createChain = () => ({
    // biome-ignore lint/suspicious/noThenProperty: Drizzle test double must be awaitable.
    ["then"](resolve: (value: unknown[]) => unknown) {
      return Promise.resolve(resolve(rowSets.shift() ?? []));
    },
    leftJoin() {
      return createChain();
    },
    where() {
      return createChain();
    },
    orderBy() {
      return createChain();
    },
    async limit() {
      return rowSets.shift() ?? [];
    },
  });

  return {
    select() {
      return {
        from() {
          return createChain();
        },
      };
    },
  };
}

describe("search handlers", () => {
  test("dispatches content delete to the search client delete path", async () => {
    const { createSearchHandlers } = await loadSearchHarness();
    const deleted: string[][] = [];
    const handlers = createSearchHandlers({
      deleteContent: async (ids: string[]) => {
        deleted.push(ids);
      },
    } as never);
    const command = createSearchCommand(SEARCH_COMMAND_KINDS.contentDelete, {
      unitId: "unit-1",
    });

    await handlers[command.kind]?.(command, {
      enqueue: async () => undefined,
    });

    expect(deleted).toEqual([["unit-1"]]);
  });

  test("patch handlers read current DB state instead of CDC event values", async () => {
    const { createSearchHandlers, setSearchDb } = await loadSearchHarness();
    const patches: Array<Record<string, unknown>> = [];
    setSearchDb(
      createDb([
        [
          {
            type: "BOOK",
            status: "PUBLISHED",
            visibility: "PUBLIC",
            moderationStatus: "APPROVED",
            catalogEntryKind: null,
          },
        ],
        [
          {
            tagUnitId: "tag-current",
            score: 12,
            title: "Current tag",
          },
        ],
        [
          {
            type: "BOOK",
            status: "PUBLISHED",
            visibility: "PUBLIC",
            moderationStatus: "APPROVED",
            catalogEntryKind: null,
          },
        ],
      ]) as never,
    );

    const handlers = createSearchHandlers({
      patchContent: async (documents: Array<Record<string, unknown>>) => {
        patches.push(...documents);
      },
    } as never);
    const command = createSearchCommand(
      SEARCH_COMMAND_KINDS.contentPatchTags,
      { unitId: "unit-1" },
      {
        type: "sequin",
        table: "UnitTag",
        action: "update",
        recordPks: { unitId: "unit-1", tagUnitId: "tag-stale" },
      },
    );

    await handlers[command.kind]?.(command, {
      enqueue: async () => undefined,
    });

    expect(patches).toEqual([
      {
        id: "unit-1",
        tagIds: ["tag-current"],
        tagScores: { "tag-current": 12 },
        tagLabels: ["Current tag"],
      },
    ]);
  });

  test("full sync rebuilds one segment and enqueues continuation", async () => {
    const { createSearchHandlers, setSearchDb } = await loadSearchHarness();
    const deleted: string[] = [];
    const added: Array<Record<string, unknown>> = [];
    const enqueued: string[] = [];
    setSearchDb(
      createDb([
        [
          {
            unitId: "entity-1",
            kind: "person",
            verified: true,
            eligibleCreditRoles: [],
            eligibleSubjectRoles: [],
            slug: "entity-1",
            userId: "user-1",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
          {
            unitId: "entity-2",
            kind: "person",
            verified: true,
            eligibleCreditRoles: [],
            eligibleSubjectRoles: [],
            slug: "entity-2",
            userId: "user-1",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
        [{ unitId: "entity-1", language: "en", title: "Entity One" }],
        [],
      ]) as never,
    );

    const handlers = createSearchHandlers({
      deleteAllEntities: async () => {
        deleted.push("entities");
      },
      addOrUpdateEntities: async (
        documents: Array<Record<string, unknown>>,
      ) => {
        added.push(...documents);
      },
    } as never);
    const command = createSearchCommand(SEARCH_COMMAND_KINDS.entityFullSync, {
      limit: 1,
    });

    await handlers[command.kind]?.(command, {
      enqueue: async (next) => {
        enqueued.push(`${next.kind}:${(next.payload as any).cursor}`);
      },
    });

    expect(deleted).toEqual(["entities"]);
    expect(added.map((doc) => doc.id)).toEqual(["entity-1"]);
    expect(enqueued).toEqual(["search.entity.fullSync:entity-1"]);
  });

  test("variant full repair continues by variant cursor", async () => {
    const { createSearchHandlers, setSearchDb } = await loadSearchHarness();
    const added: Array<Record<string, unknown>> = [];
    const enqueued: string[] = [];
    setSearchDb(
      createDb([
        [
          {
            id: "release-1",
            type: "BOOK",
            status: "PUBLISHED",
            moderationStatus: "APPROVED",
            defaultLanguage: "en",
            visibility: "PUBLIC",
            rating: "GENERAL",
            userId: "user-1",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            publishedAt: null,
            catalogEntryKind: "VARIANT",
            targetUnitId: "main-1",
          },
          {
            id: "release-2",
            type: "BOOK",
            status: "PUBLISHED",
            moderationStatus: "APPROVED",
            defaultLanguage: "en",
            visibility: "PUBLIC",
            rating: "GENERAL",
            userId: "user-1",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            publishedAt: null,
            catalogEntryKind: "VARIANT",
            targetUnitId: "main-1",
          },
        ],
        [{ unitId: "release-1", language: "en", title: "Release One" }],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [{ unitId: "release-1", textLength: 100, isLicensed: false }],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
      ]) as never,
    );

    const handlers = createSearchHandlers({
      addOrUpdateContent: async (documents: Array<Record<string, unknown>>) => {
        added.push(...documents);
      },
    } as never);
    const command = createSearchCommand(
      SEARCH_COMMAND_KINDS.contentReleaseFullSync,
      { limit: 1 },
    );

    await handlers[command.kind]?.(command, {
      enqueue: async (next) => {
        enqueued.push(`${next.kind}:${(next.payload as any).cursor}`);
      },
    });

    expect(added.map((doc) => doc.id)).toEqual(["release-1"]);
    expect(enqueued).toEqual(["search.content.releaseFullSync:release-1"]);
  });
});
