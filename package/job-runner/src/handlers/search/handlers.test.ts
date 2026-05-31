import { describe, expect, test } from "bun:test";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { setSearchPrismaClient } from "@rezics/search";
import { createSearchHandlers } from "./handlers";

describe("search handlers", () => {
  test("dispatches content delete to the search client delete path", async () => {
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
    const patches: Array<Record<string, unknown>> = [];
    setSearchPrismaClient({
      unit: {
        findUnique: async () => ({
          type: "BOOK",
          status: "PUBLISHED",
          visibility: "PUBLIC",
          catalogEntryKind: null,
        }),
      },
      unitTag: {
        findMany: async () => [
          {
            tagUnitId: "tag-current",
            score: 12,
            pinned: false,
            tag: { translations: [{ title: "Current tag" }] },
          },
        ],
      },
    } as never);

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
    const deleted: string[] = [];
    const added: Array<Record<string, unknown>> = [];
    const enqueued: string[] = [];
    setSearchPrismaClient({
      entity: {
        findMany: async () => [
          {
            unitId: "entity-1",
            kind: "person",
            verified: true,
            eligibleCreditRoles: [],
            eligibleSubjectRoles: [],
            unit: {
              slug: "entity-1",
              userId: "user-1",
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:00:00.000Z"),
              translations: [{ language: "en", title: "Entity One" }],
              aliases: [],
            },
          },
          {
            unitId: "entity-2",
            kind: "person",
            verified: true,
            eligibleCreditRoles: [],
            eligibleSubjectRoles: [],
            unit: {
              slug: "entity-2",
              userId: "user-1",
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:00:00.000Z"),
              translations: [{ language: "en", title: "Entity Two" }],
              aliases: [],
            },
          },
        ],
      },
    } as never);

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
    const added: Array<Record<string, unknown>> = [];
    const enqueued: string[] = [];
    setSearchPrismaClient({
      unit: {
        findMany: async (args: any) => {
          expect(args.where.catalogEntryKind).toBe("VARIANT");
          return [
            {
              id: "release-1",
              type: "BOOK",
              defaultLanguage: "en",
              visibility: "PUBLIC",
              rating: "GENERAL",
              userId: "user-1",
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:00:00.000Z"),
              publishedAt: null,
              translations: [{ language: "en", title: "Release One" }],
              unitTags: [],
              catalogEntryKind: "VARIANT",
              targetUnitId: "main-1",
              inRealms: [],
              realmTagApplicationsAsTargetUnit: [],
              creditAttributions: [],
              book: { textLength: 100, isLicensed: false },
            },
            {
              id: "release-2",
              type: "BOOK",
              defaultLanguage: "en",
              visibility: "PUBLIC",
              rating: "GENERAL",
              userId: "user-1",
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:00:00.000Z"),
              publishedAt: null,
              translations: [{ language: "en", title: "Release Two" }],
              unitTags: [],
              catalogEntryKind: "VARIANT",
              targetUnitId: "main-1",
              inRealms: [],
              realmTagApplicationsAsTargetUnit: [],
              creditAttributions: [],
              book: { textLength: 100, isLicensed: false },
            },
          ];
        },
      },
    } as never);

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
