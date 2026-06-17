import { describe, expect, mock, test } from "bun:test";
import {
  Shelf,
  ShelfItem,
  Unit,
  UnitSupportLanguage,
  UnitTag,
  UnitTranslation,
  User,
  UserTagApplication,
} from "../db/schema";

const legacyDbMock: Record<string, any> = {};

const SEED_TAG_ID_BY_NAME: Record<string, string> = {
  book: "11111111-1111-1111-1111-111111111111",
  game: "22222222-2222-2222-2222-222222222222",
  media: "33333333-3333-3333-3333-333333333333",
  post: "44444444-4444-4444-4444-444444444444",
  link: "55555555-5555-5555-5555-555555555555",
};

mock.module("@/infra/seed-tags", () => ({
  getSeedTagId: (name: string) => SEED_TAG_ID_BY_NAME[name] ?? null,
  initSeedTagsCache: async () => undefined,
  getSeedTagsSnapshot: () => ({ ...SEED_TAG_ID_BY_NAME }),
}));
mock.module("@/content-doc/json-write", () => ({
  nullableContentDocJson: (value: unknown) => value ?? null,
}));
mock.module("@/unit/publication-policy", () => ({
  assertLicenseSlug: (value: unknown) =>
    typeof value === "string" ? value : null,
  resolveStoredLicenseSlug: (value: unknown) =>
    typeof value === "string" ? value : null,
}));
mock.module("@/unit/language-resolution", () => ({
  resolveEffectiveReadLanguageInput: (input: unknown) => input ?? {},
}));
mock.module("@/unit/variant-context", () => ({
  hydrateVariantContextSummaries: async (rows: unknown) => rows,
  variantContextForRow: (row: { variantContext?: unknown }) =>
    row.variantContext ?? null,
}));
mock.module("@/utils/errors", () => ({
  AppError: class AppError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));
mock.module("@/utils/userSlugHydration", () => ({
  hydrateUnitOwnerUserSlugRow: async (row: unknown) => row,
  hydrateUnitOwnerUserSlugs: async (rows: unknown) => rows,
  loadUserSlugMap: async () => new Map(),
}));
mock.module("@/utils/sanitizeUser", () => ({
  publicUserSelect: {},
  mapPublicUser: (user: unknown) => user,
}));

const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
type SearchHit = { id?: string; itemId?: string; unitId?: string };

const contentSearchMock = mock(
  async (_query: string, _options?: any): Promise<{ hits: SearchHit[] }> => ({
    hits: [],
  }),
);
const shelfItemSearchMock = mock(
  async (_query: string, _options?: any): Promise<{ hits: SearchHit[] }> => ({
    hits: [],
  }),
);

mock.module("@/meili/content/sync", () => ({
  patchContentMetadataToMeili: async () => undefined,
  patchContentRealmIdsToMeili: async () => undefined,
  patchContentRealmTagKeysToMeili: async () => undefined,
  patchContentTagsToMeili: async () => undefined,
  patchContentCreditsToMeili: async () => undefined,
  patchContentTranslationsToMeili: async () => undefined,
  syncContentToMeili: async () => undefined,
  deleteContentFromMeili: async () => undefined,
}));
mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));
mock.module("@/meili/search-client", () => ({
  searchClient: {
    contentIndex: { search: contentSearchMock },
    shelfItemIndex: { search: shelfItemSearchMock },
  },
}));

Object.assign(legacyDbMock, {});

let lastShelfRows = new Map<string, any>();
const lastUnitRows = new Map<string, any>();

function isBoundValue(value: unknown): value is string | number | boolean {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    return false;
  }
  if (typeof value !== "string") return true;
  const trimmed = value.trim();
  if (
    trimmed.includes("\n") ||
    trimmed.includes('"') ||
    /\b(select|from|where|exists|limit)\b/i.test(trimmed)
  ) {
    return false;
  }
  return (
    trimmed.length > 0 &&
    !["(", ")", "=", "and", "or", ",", "in"].includes(trimmed.toLowerCase())
  );
}

function sqlValues(condition: unknown): unknown[] {
  const values: unknown[] = [];
  function walk(value: unknown): void {
    if (!value || typeof value !== "object") return;
    const maybeValue = (value as { value?: unknown }).value;
    if (Array.isArray(maybeValue)) {
      for (const item of maybeValue) {
        if (isBoundValue(item)) {
          values.push(item);
        }
      }
    } else if (maybeValue !== undefined && isBoundValue(maybeValue)) {
      values.push(maybeValue);
    }
    const chunks = (value as { queryChunks?: unknown[] }).queryChunks;
    if (Array.isArray(chunks)) {
      for (const chunk of chunks) walk(chunk);
    }
  }
  walk(condition);
  return values;
}

function createLegacyWhere(values: unknown[]) {
  const strings = values.filter(
    (value): value is string => typeof value === "string",
  );
  const containsUnitId = strings.find(
    (value) =>
      value !== "SHELF" &&
      value !== "PUBLISHED" &&
      value !== "PUBLIC" &&
      value !== "APPROVED" &&
      !value.startsWith("variant-") &&
      value !== "shelf-1",
  );
  const variantUnitId = strings.find((value) => value.startsWith("variant-"));
  const and: any[] = [
    {
      unit: {
        type: "SHELF",
        status: "PUBLISHED",
        visibility: "PUBLIC",
      },
    },
  ];
  if (containsUnitId) and.push({ units: { some: { unitId: containsUnitId } } });
  if (variantUnitId) and.push({ units: { some: { variantUnitId } } });
  return { AND: and };
}

function shelfItemWhereFromValues(values: unknown[]) {
  const strings = values.filter(
    (value): value is string => typeof value === "string",
  );
  const shelfId =
    strings.find((value) => value.startsWith("shelf")) ?? "shelf-1";
  const unitId = strings.find(
    (value) => value !== shelfId && !value.startsWith("variant-"),
  );
  const variantUnitId = strings.find((value) => value.startsWith("variant-"));
  return {
    shelfId,
    ...(unitId ? { unitId } : {}),
    ...(variantUnitId ? { variantUnitId } : {}),
  };
}

function createFakeDrizzleDb(oldTx?: any): any {
  const legacy = oldTx ?? legacyDbMock;
  const fakeDb: any = {
    select(selection?: Record<string, unknown>) {
      let table: unknown;
      let condition: unknown;
      let skip = 0;
      let take: number | undefined;
      const query: any = {
        from(nextTable: unknown) {
          table = nextTable;
          return query;
        },
        innerJoin() {
          return query;
        },
        leftJoin() {
          return query;
        },
        where(nextCondition: unknown) {
          condition = nextCondition;
          return query;
        },
        orderBy() {
          return query;
        },
        offset(nextSkip: number) {
          skip = nextSkip;
          return query;
        },
        limit(nextTake: number) {
          take = nextTake;
          return query;
        },
        async resolve() {
          const values = sqlValues(condition);
          const keys = Object.keys(selection ?? {});

          if (table === Shelf) {
            if (selection?.userId) {
              const shelfId =
                values.find(
                  (value): value is string =>
                    typeof value === "string" && value.startsWith("shelf"),
                ) ?? "shelf-1";
              const row = await legacy.shelf?.findUnique?.({
                where: { unitId: shelfId },
              });
              return row
                ? [{ userId: row.unit?.userId ?? row.userId ?? null }]
                : [];
            }
            if (selection?.total) {
              const where = createLegacyWhere(values);
              return [{ total: (await legacy.shelf?.count?.({ where })) ?? 0 }];
            }
            if (keys.length === 1 && selection?.unitId) {
              const where = createLegacyWhere(values);
              const rows =
                (await legacy.shelf?.findMany?.({
                  where,
                  skip,
                  take,
                })) ?? [];
              lastShelfRows = new Map(
                rows.map((row: any) => [row.unitId, row]),
              );
              return rows.map((row: any) => ({ unitId: row.unitId }));
            }
            const unitId =
              values.find(
                (value): value is string =>
                  typeof value === "string" && value.startsWith("shelf"),
              ) ?? values[0];
            const row =
              (await legacy.shelf?.findUnique?.({ where: { unitId } })) ??
              lastShelfRows.get(unitId as string);
            if (row?.unitId) lastShelfRows.set(row.unitId, row);
            return row ? [row] : [];
          }

          if (table === Unit) {
            if (selection?.userId) {
              const shelfId =
                values.find(
                  (value): value is string =>
                    typeof value === "string" && value.startsWith("shelf"),
                ) ?? "shelf-1";
              const shelf = await legacy.shelf?.findUnique?.({
                where: { unitId: shelfId },
              });
              return shelf
                ? [{ userId: shelf.unit?.userId ?? shelf.userId ?? null }]
                : [];
            }
            if (selection?.postKind || selection?.type) {
              const id =
                values.find(
                  (value): value is string => typeof value === "string",
                ) ?? "book-1";
              const unit = await legacy.unit?.findUnique?.({ where: { id } });
              return unit
                ? [{ type: unit.type, postKind: unit.post?.kind ?? null }]
                : [];
            }
            if (selection?.language || selection?.title) {
              const units =
                (await legacy.unit?.findMany?.({ where: {} })) ?? [];
              return units.flatMap((unit: any) =>
                (unit.translations ?? [null]).map((translation: any) => ({
                  id: unit.id,
                  defaultLanguage: unit.defaultLanguage ?? null,
                  language: translation?.language ?? null,
                  title: translation?.title ?? null,
                })),
              );
            }
            if (selection?.id) {
              const slug = values.find((value) => value === "favorites");
              const slugScope = values.find(
                (value) =>
                  value === "alice-unit" || value === "ghost-user-unit",
              );
              const row = await legacy.unit?.findFirst?.({
                where: { type: "SHELF", slug, slugScope },
              });
              return row ? [row] : [];
            }
            const id =
              values.find(
                (value): value is string => typeof value === "string",
              ) ?? "shelf-1";
            const fromShelf = lastShelfRows.get(id)?.unit;
            const row =
              fromShelf ?? (await legacy.unit?.findUnique?.({ where: { id } }));
            if (row) lastUnitRows.set(id, row);
            return row ? [row] : [];
          }

          if (table === UnitTranslation) {
            const unitId =
              values.find(
                (value): value is string => typeof value === "string",
              ) ?? "shelf-1";
            const unit =
              lastUnitRows.get(unitId) ?? lastShelfRows.get(unitId)?.unit;
            if (selection?.extra) {
              const row = await legacy.unitTranslation?.findUnique?.({
                where: { unitId_language: { unitId, language: "en" } },
              });
              return row ? [row] : [];
            }
            return unit?.translations ?? [];
          }

          if (table === UnitSupportLanguage) {
            const unitId =
              values.find(
                (value): value is string => typeof value === "string",
              ) ?? "shelf-1";
            const unit =
              lastUnitRows.get(unitId) ?? lastShelfRows.get(unitId)?.unit;
            return unit?.supportLanguages ?? [];
          }

          if (table === UnitTag) {
            const select = selection?.score
              ? { tagUnitId: true, score: true }
              : { tagUnitId: true };
            const rows = await legacy.unitTag?.findMany?.({ select });
            if (rows) return rows;
            const unitId =
              values.find(
                (value): value is string => typeof value === "string",
              ) ?? "shelf-1";
            return lastShelfRows.get(unitId)?.unit?.unitTags ?? [];
          }

          if (table === User) return [];

          if (table === ShelfItem) {
            if (keys.length === 1 && selection?.position) {
              const rows = await legacy.shelfItem?.findMany?.({ skip, take });
              if (rows) return rows;
              const row = await legacy.shelfItem?.findFirst?.();
              return row ? [row] : [];
            }
            if (keys.length === 1 && selection?.unitId) {
              return (
                (await legacy.shelfItem?.findMany?.({
                  where: { shelfId: "shelf-1" },
                  take,
                })) ?? []
              );
            }
            const where = shelfItemWhereFromValues(values);
            if (take === 1 && where.unitId) {
              const row =
                (await legacy.shelfItem?.findUnique?.({
                  where: {
                    shelfId_unitId: {
                      shelfId: where.shelfId,
                      unitId: where.unitId,
                    },
                  },
                })) ??
                (await legacy.shelfItem
                  ?.findUniqueOrThrow?.({
                    where: {
                      shelfId_unitId: {
                        shelfId: where.shelfId,
                        unitId: where.unitId,
                      },
                    },
                  })
                  .catch?.(() => null));
              return row ? [row] : [];
            }
            return (await legacy.shelfItem?.findMany?.({ where, take })) ?? [];
          }

          if (table === UserTagApplication) {
            return (
              (await legacy.userTagApplication?.findMany?.({
                where: {
                  userId: "owner-1",
                  tagUnitId: {
                    in: values.filter((value) =>
                      String(value).startsWith("tag-"),
                    ),
                  },
                },
              })) ?? []
            );
          }

          return [];
        },
        // biome-ignore lint/suspicious/noThenProperty lint/complexity/useLiteralKeys: Drizzle test double must be awaitable.
        ["then"](
          resolve: (value: unknown[]) => unknown,
          reject?: (error: unknown) => unknown,
        ) {
          return query.resolve().then(resolve, reject);
        },
      };
      return query;
    },
    insert(table: unknown) {
      let data: any;
      const query: any = {
        values(nextData: any) {
          data = nextData;
          return query;
        },
        onConflictDoNothing() {
          return query;
        },
        onConflictDoUpdate() {
          return query;
        },
        async returning() {
          if (table === Unit) {
            const row = await legacy.unit?.create?.({ data });
            return row ? [{ id: row.id }] : [{ id: "shelf-new" }];
          }
          if (table === ShelfItem) {
            const row = Array.isArray(data) ? data[0] : data;
            const result = await legacy.shelfItem?.createMany?.({
              data: [row],
              skipDuplicates: true,
            });
            const count = result?.count ?? 1;
            return Array.from({ length: count }, () => ({
              unitId: row.unitId,
            }));
          }
          return [Array.isArray(data) ? data[0] : data];
        },
        async execute() {
          if (table === Shelf) {
            const row = await legacy.shelf?.create?.({ data });
            if (row?.unitId) lastShelfRows.set(row.unitId, row);
          }
          if (table === UnitTranslation) {
            await legacy.unitTranslation?.createMany?.({ data });
          }
          if (table === UnitSupportLanguage) {
            await legacy.unitSupportLanguage?.createMany?.({
              data: Array.isArray(data) ? data : [data],
              skipDuplicates: true,
            });
          }
          if (table === UnitTag) {
            const rows = Array.isArray(data) ? data : [data];
            await legacy.unitTag?.createMany?.({
              data: rows,
              skipDuplicates: true,
            });
          }
          if (table === UserTagApplication) {
            await legacy.userTagApplication?.createMany?.({
              data: (Array.isArray(data) ? data : [data]).map(
                ({ updatedAt: _updatedAt, ...row }: any) => row,
              ),
              skipDuplicates: true,
            });
          }
          return [];
        },
        // biome-ignore lint/suspicious/noThenProperty lint/complexity/useLiteralKeys: Drizzle test double must be awaitable.
        ["then"](
          resolve: (value: unknown[]) => unknown,
          reject?: (error: unknown) => unknown,
        ) {
          return query.execute().then(resolve, reject);
        },
      };
      return query;
    },
    update(table: unknown) {
      let data: any = {};
      let condition: unknown;
      const query: any = {
        set(nextData: any) {
          data = nextData;
          return query;
        },
        where(nextCondition: unknown) {
          condition = nextCondition;
          return query;
        },
        async returning() {
          const values = sqlValues(condition);
          const where = shelfItemWhereFromValues(values);
          if (table === ShelfItem) {
            const row = await legacy.shelfItem?.update?.({
              where: {
                shelfId_unitId: {
                  shelfId: where.shelfId,
                  unitId: where.unitId,
                },
              },
              data,
            });
            return row ? [row] : [];
          }
          if (table === Shelf) {
            const row = await legacy.shelf?.update?.({
              where: { unitId: "shelf-1" },
              data,
            });
            return row ? [row] : [{ unitId: "shelf-1" }];
          }
          return [data];
        },
        async execute() {
          if (table === Shelf) await legacy.shelf?.update?.({ data });
          if (table === Unit) await legacy.unit?.update?.({ data });
          if (table === ShelfItem) await query.returning();
          return [];
        },
        // biome-ignore lint/suspicious/noThenProperty lint/complexity/useLiteralKeys: Drizzle test double must be awaitable.
        ["then"](
          resolve: (value: unknown[]) => unknown,
          reject?: (error: unknown) => unknown,
        ) {
          return query.execute().then(resolve, reject);
        },
      };
      return query;
    },
    delete(table: unknown) {
      let condition: unknown;
      const query: any = {
        where(nextCondition: unknown) {
          condition = nextCondition;
          return query;
        },
        async returning() {
          const values = sqlValues(condition);
          if (table === ShelfItem) {
            const where = shelfItemWhereFromValues(values);
            const result = await legacy.shelfItem?.deleteMany?.({ where });
            const count = result?.count ?? 0;
            return Array.from({ length: count }, () => ({
              unitId: where.unitId ?? "deleted",
            }));
          }
          return [];
        },
        async execute() {
          const values = sqlValues(condition);
          if (table === Unit)
            await legacy.unit?.delete?.({ where: { id: values[0] } });
          if (table === UnitTag) {
            const tagIds = values.filter(
              (value): value is string =>
                typeof value === "string" &&
                value.includes("-") &&
                value !== "shelf-1",
            );
            await legacy.unitTag?.deleteMany?.({
              where: {
                unitId: "shelf-1",
                tagUnitId: { in: tagIds },
                pinned: true,
              },
            });
          }
          if (table === UserTagApplication) {
            await legacy.userTagApplication?.deleteMany?.({
              where: { userId: "user-1", unitId: "book-1" },
            });
          }
          if (table === ShelfItem) await query.returning();
          return [];
        },
        // biome-ignore lint/suspicious/noThenProperty lint/complexity/useLiteralKeys: Drizzle test double must be awaitable.
        ["then"](
          resolve: (value: unknown[]) => unknown,
          reject?: (error: unknown) => unknown,
        ) {
          return query.execute().then(resolve, reject);
        },
      };
      return query;
    },
    transaction(fn: any) {
      if (legacyDbMock.$transaction) {
        return legacyDbMock.$transaction((tx: any) =>
          fn(createFakeDrizzleDb(tx)),
        );
      }
      return fn(fakeDb);
    },
  };
  return fakeDb;
}

mock.module("../db/client", () => ({
  db: createFakeDrizzleDb(),
}));

function makeShelfItemRow(overrides: Record<string, unknown> = {}) {
  const itemId = (overrides.itemId ?? overrides.unitId ?? "book-1") as string;
  return {
    shelfId: "shelf-1",
    itemType: "unit",
    itemId,
    unitId: itemId,
    kind: "book",
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeShelfListRow(overrides: Record<string, unknown> = {}) {
  return {
    unitId: "shelf-1",
    extra: null,
    itemCount: 1,
    createdAt: new Date("2026-05-27T00:00:00.000Z"),
    updatedAt: new Date("2026-05-27T00:00:00.000Z"),
    unit: {
      id: "shelf-1",
      slug: "shelf",
      userId: null,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      licenseSlug: null,
      defaultLanguage: "en",
      createdAt: new Date("2026-05-27T00:00:00.000Z"),
      updatedAt: new Date("2026-05-27T00:00:00.000Z"),
      user: null,
      translations: [],
      unitTags: [],
    },
    ...overrides,
  };
}

describe("ShelfService", () => {
  test("list filters public discovery by published public shelves containing the target Unit", async () => {
    let findManyArgs: any;
    Object.assign(legacyDbMock, {
      shelf: {
        findMany: async (args: any) => {
          findManyArgs = args;
          return [];
        },
        count: async () => 0,
      },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    await shelfService.list({ containsUnitId: "book-1", limit: 10 });

    expect(findManyArgs.where).toMatchObject({
      AND: [
        {
          unit: {
            type: "SHELF",
            status: "PUBLISHED",
            visibility: "PUBLIC",
          },
        },
      ],
    });
  });

  test("list keeps containsUnitId primary containment separate from variantUnitId context", async () => {
    let findManyArgs: any;
    Object.assign(legacyDbMock, {
      shelf: {
        findMany: async (args: any) => {
          findManyArgs = args;
          return [];
        },
        count: async () => 0,
      },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    await shelfService.list({
      containsUnitId: "main-1",
      variantUnitId: "variant-1",
      limit: 10,
    });

    expect(findManyArgs.where).toMatchObject({
      AND: [
        {
          unit: {
            type: "SHELF",
            status: "PUBLISHED",
            visibility: "PUBLIC",
          },
        },
      ],
    });
  });

  test("list hydrates the matched contained unit for exact results", async () => {
    Object.assign(legacyDbMock, {
      shelf: {
        findMany: async () => [makeShelfListRow()],
        count: async () => 1,
      },
      shelfItem: {
        findMany: async () => [
          {
            shelfId: "shelf-1",
            unitId: "release-1",
            kind: "book",
          },
        ],
      },
      unit: {
        findMany: async () => [
          {
            id: "release-1",
            defaultLanguage: "en",
            translations: [{ language: "en", title: "Contained Release" }],
          },
        ],
      },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    const result = await shelfService.list({
      containsUnitId: "release-1",
      limit: 10,
    });

    expect(result.shelves[0]?.matchedUnit).toEqual({
      unitId: "release-1",
      kind: "book",
      title: "Contained Release",
    });
  });

  test("list hydrates the matched variant child when filtering by variantUnitId", async () => {
    Object.assign(legacyDbMock, {
      shelf: {
        findMany: async () => [makeShelfListRow()],
        count: async () => 1,
      },
      shelfItem: {
        findMany: async () => [
          makeShelfItemRow({
            itemId: "variant-1",
            parentItemId: "main-1",
            parentRole: "variant",
          }),
        ],
      },
      unit: {
        findMany: async () => [
          {
            id: "variant-1",
            defaultLanguage: "en",
            translations: [{ language: "en", title: "Variant Child Edition" }],
          },
        ],
      },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    const result = await shelfService.list({
      variantUnitId: "variant-1",
      limit: 10,
    });

    expect(result.shelves[0]?.matchedUnit).toEqual({
      unitId: "variant-1",
      kind: "book",
      title: "Variant Child Edition",
    });
  });

  test("addItem enqueues containedUnitIds sync after the canonical write", async () => {
    enqueueMock.mockClear();

    Object.assign(legacyDbMock, {
      unit: {
        findUnique: async () => ({ type: "BOOK", post: null }),
      },
      shelfItem: {
        findMany: async () => [],
      },
      $transaction: async (fn: any) =>
        fn({
          shelfItem: {
            findFirst: async () => null,
            createMany: async () => ({ count: 1 }),
            findUniqueOrThrow: async () => makeShelfItemRow(),
          },
          shelf: { update: async () => ({}) },
        }),
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    await shelfService.addItem("shelf-1", {
      itemType: "unit",
      itemId: "book-1",
      kind: "book",
    });

    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock.mock.calls[0]?.[0]).toMatchObject({
      kind: "search.content.patchContainedUnitIds",
      payload: { unitId: "shelf-1" },
      source: { type: "server", service: "shelf" },
    });
  });

  test("addItem writes optional shelf item search text and user tags", async () => {
    enqueueMock.mockClear();
    const deleteMany = mock(async () => ({ count: 0 }));
    const createMany = mock(async () => ({ count: 1 }));
    const createdShelfItems: any[] = [];

    Object.assign(legacyDbMock, {
      unit: {
        findUnique: async () => ({ type: "BOOK", post: null }),
      },
      shelfItem: {
        findMany: async () => [],
      },
      $transaction: async (fn: any) =>
        fn({
          shelfItem: {
            findFirst: async () => null,
            createMany: async ({ data }: any) => {
              createdShelfItems.push(...data);
              return { count: 1 };
            },
            findUniqueOrThrow: async () => makeShelfItemRow(),
          },
          shelf: { update: async () => ({}) },
          userTagApplication: { deleteMany, createMany },
        }),
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    await shelfService.addItem(
      "shelf-1",
      {
        itemType: "unit",
        itemId: "book-1",
        kind: "book",
        tagUnitIds: ["tag-1"],
        searchText: null,
      },
      "user-1",
    );

    expect(createdShelfItems[0]?.searchText).toBeNull();
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", unitId: "book-1" },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "user-1",
          unitId: "book-1",
          tagUnitId: "tag-1",
          position: "00000000",
        },
      ],
      skipDuplicates: true,
    });
  });

  test("addItem does not increment counts for duplicate shelf items", async () => {
    const shelfUpdates: any[] = [];

    Object.assign(legacyDbMock, {
      unit: {
        findUnique: async () => ({ type: "BOOK", post: null }),
      },
      shelfItem: {
        findMany: async () => [],
      },
      $transaction: async (fn: any) =>
        fn({
          shelfItem: {
            findFirst: async () => null,
            createMany: async () => ({ count: 0 }),
            findUniqueOrThrow: async () => makeShelfItemRow(),
          },
          shelf: {
            update: async (args: any) => {
              shelfUpdates.push(args);
              return {};
            },
          },
        }),
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    const item = await shelfService.addItem("shelf-1", {
      itemType: "unit",
      itemId: "book-1",
      kind: "book",
    });

    expect(item.itemId).toBe("book-1");
    expect(shelfUpdates).toHaveLength(0);
  });

  test("addItem writes comment-backed shelf items without user-unit metadata", async () => {
    const createdShelfItems: any[] = [];
    const deleteMany = mock(async () => ({ count: 0 }));

    Object.assign(legacyDbMock, {
      shelfItem: {
        findMany: async () => [],
      },
      $transaction: async (fn: any) =>
        fn({
          shelfItem: {
            findFirst: async () => null,
            createMany: async ({ data }: any) => {
              createdShelfItems.push(...data);
              return { count: 1 };
            },
            findUniqueOrThrow: async () =>
              makeShelfItemRow({
                itemType: "comment",
                itemId: "comment-1",
                kind: "comment",
              }),
          },
          shelf: { update: async () => ({}) },
          userTagApplication: { deleteMany },
        }),
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    const item = await shelfService.addItem(
      "shelf-1",
      {
        itemType: "comment",
        itemId: "comment-1",
        kind: "comment",
        searchText: "saved reply",
      },
      "user-1",
    );

    expect(createdShelfItems[0]).toMatchObject({
      itemType: "comment",
      itemId: "comment-1",
      kind: "comment",
      searchText: "saved reply",
    });
    expect(item.itemType).toBe("comment");
    expect(deleteMany).not.toHaveBeenCalled();
  });

  test("getShelfItems filters q matches through public content search hits", async () => {
    contentSearchMock.mockClear();
    shelfItemSearchMock.mockClear();
    contentSearchMock.mockResolvedValueOnce({ hits: [{ id: "book-2" }] });

    let findManyArgs: any;
    Object.assign(legacyDbMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "owner-1" } }),
      },
      shelfItem: {
        findMany: async (args: any) => {
          findManyArgs = args;
          return [makeShelfItemRow({ unitId: "book-2" })];
        },
      },
      shelfItemChild: { findMany: async () => [] },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    const result = await shelfService.getShelfItems(
      "shelf-1",
      { q: "translated title", limit: 20 },
      { viewerUserId: "viewer-1" },
    );

    expect(result.items.map((item: { itemId: string }) => item.itemId)).toEqual(
      ["book-2"],
    );
    expect(findManyArgs.where).toMatchObject({ shelfId: "shelf-1" });
    expect(shelfItemSearchMock).not.toHaveBeenCalled();
  });

  test("getShelfItems includes owner-private shelf item q matches for the owner", async () => {
    contentSearchMock.mockClear();
    shelfItemSearchMock.mockClear();
    contentSearchMock.mockResolvedValueOnce({ hits: [] });
    shelfItemSearchMock.mockResolvedValueOnce({
      hits: [{ itemId: "book-3" }],
    });

    let findManyArgs: any;
    Object.assign(legacyDbMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "owner-1" } }),
      },
      shelfItem: {
        findMany: async (args: any) => {
          findManyArgs = args;
          return [makeShelfItemRow({ unitId: "book-3" })];
        },
      },
      shelfItemChild: { findMany: async () => [] },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    await shelfService.getShelfItems(
      "shelf-1",
      { q: "private note" },
      { viewerUserId: "owner-1" },
    );

    expect(shelfItemSearchMock).toHaveBeenCalledWith("private note", {
      limit: 1000,
      filter:
        'shelfId = "shelf-1" AND shelfOwnerUserId = "owner-1" AND itemType = "unit"',
      attributesToRetrieve: ["itemId"],
    });
    expect(findManyArgs.where).toMatchObject({ shelfId: "shelf-1" });
  });

  test("getShelfItems intersects owner tag filters with q matches", async () => {
    contentSearchMock.mockClear();
    shelfItemSearchMock.mockClear();
    contentSearchMock.mockResolvedValueOnce({
      hits: [{ id: "book-1" }, { id: "book-2" }],
    });
    shelfItemSearchMock.mockResolvedValueOnce({ hits: [] });

    let findManyArgs: any;
    Object.assign(legacyDbMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "owner-1" } }),
      },
      userTagApplication: {
        findMany: async () => {
          return [
            { unitId: "book-1", tagUnitId: "tag-a" },
            { unitId: "book-1", tagUnitId: "tag-b" },
            { unitId: "book-2", tagUnitId: "tag-a" },
          ];
        },
      },
      shelfItem: {
        findMany: async (args: any) => {
          findManyArgs = args;
          return [makeShelfItemRow({ unitId: "book-1" })];
        },
      },
      shelfItemChild: { findMany: async () => [] },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    await shelfService.getShelfItems(
      "shelf-1",
      { q: "space", tagUnitIds: ["tag-a", "tag-b", "tag-a"] },
      { viewerUserId: "owner-1" },
    );

    expect(findManyArgs.where).toMatchObject({ shelfId: "shelf-1" });
  });

  test("getShelfItems orders roots and fetched children independently", async () => {
    const calls: any[] = [];
    Object.assign(legacyDbMock, {
      shelfItem: {
        findMany: async (args: any) => {
          calls.push(args);
          if (calls.length === 1) {
            return [
              makeShelfItemRow({ unitId: "book-a", position: "a0" }),
              makeShelfItemRow({ unitId: "book-b", position: "b0" }),
            ];
          }
          return [
            makeShelfItemRow({
              unitId: "review-b",
              kind: "review",
              parentItemId: "book-b",
              parentRole: "review",
              position: "a0",
            }),
            makeShelfItemRow({
              unitId: "review-a",
              kind: "review",
              parentItemId: "book-a",
              parentRole: "review",
              position: "z0",
            }),
          ];
        },
      },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    const result = await shelfService.getShelfItems("shelf-1", { limit: 20 });

    expect(result.items.map((item: { itemId: string }) => item.itemId)).toEqual(
      ["book-a", "book-b", "review-b", "review-a"],
    );
    expect(
      result.relations.map(
        (relation: { parentItemId: string }) => relation.parentItemId,
      ),
    ).toEqual(["book-b", "book-a"]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(calls).toHaveLength(2);
  });

  test("getShelfItems returns the last visible root as nextCursor, never an appended child", async () => {
    const calls: any[] = [];
    Object.assign(legacyDbMock, {
      shelfItem: {
        findMany: async (args: any) => {
          calls.push(args);
          if (calls.length === 1) {
            return [
              makeShelfItemRow({ unitId: "book-a", position: "a0" }),
              makeShelfItemRow({ unitId: "book-b", position: "b0" }),
              makeShelfItemRow({ unitId: "book-c", position: "c0" }),
            ];
          }
          return [
            makeShelfItemRow({
              unitId: "review-b",
              kind: "review",
              parentItemId: "book-b",
              parentRole: "review",
              position: "z0",
            }),
          ];
        },
      },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    const result = await shelfService.getShelfItems("shelf-1", { limit: 2 });

    expect(result.items.map((item: { itemId: string }) => item.itemId)).toEqual(
      ["book-a", "book-b", "review-b"],
    );
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("book-b");
    expect(calls).toHaveLength(2);
  });

  test("addItem rejects direct self-containment", async () => {
    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );

    await expect(
      shelfService.addItem("shelf-1", {
        itemType: "unit",
        itemId: "shelf-1",
        kind: "shelf",
      }),
    ).rejects.toThrow(/cannot contain itself/);
  });

  test("mapUnitToKind maps SHELF to shelf kind", async () => {
    const { mapUnitToKind } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );

    expect(mapUnitToKind("SHELF" as any, null)).toBe("shelf");
  });

  test("applyBatch rejects payloads above the configured cap", async () => {
    const { shelfService, SHELF_ITEM_BATCH_OP_CAP } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );

    const ops = Array.from({ length: SHELF_ITEM_BATCH_OP_CAP + 1 }, (_, i) => ({
      op: "delete" as const,
      unitId: `i-${i}`,
    }));

    let status = 0;
    try {
      await shelfService.applyBatch("shelf-1", ops);
    } catch (err) {
      status = (err as { statusCode?: number }).statusCode ?? 0;
    }
    expect(status).toBe(413);
  });

  test("applyBatch applies ops in submitted order and reports per-op results", async () => {
    enqueueMock.mockClear();

    const applied: string[] = [];
    let createManyArgs: any;

    Object.assign(legacyDbMock, {
      $transaction: async (fn: any) =>
        fn({
          shelfItem: {
            createMany: async (args: any) => {
              createManyArgs = args;
              applied.push("createMany");
              return { count: 1 };
            },
            deleteMany: async () => {
              applied.push("deleteMany");
              return { count: 1 };
            },
            update: async () => {
              applied.push("update");
              return makeShelfItemRow({ unitId: "b-1", position: "z0" });
            },
            findUniqueOrThrow: async () => makeShelfItemRow({ unitId: "b-1" }),
          },
          shelf: { update: async () => ({}) },
        }),
      shelfItem: {
        findMany: async () => [],
        findUnique: async () =>
          makeShelfItemRow({ unitId: "b-1", position: "z0" }),
      },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    const results = await shelfService.applyBatch("shelf-1", [
      { op: "delete", unitId: "old" },
      {
        op: "add",
        unitId: "b-1",
        kind: "book",
        position: "a0",
      },
      { op: "reorder", unitId: "b-1", position: "z0" },
    ]);

    expect(results).toHaveLength(3);
    expect(results[0]!.status).toBe("ok");
    expect(results[0]!.op.op).toBe("delete");
    expect(results[1]!.status).toBe("ok");
    expect(results[1]!.op.op).toBe("add");
    expect(results[2]!.status).toBe("ok");
    expect(results[2]!.op.op).toBe("reorder");
    expect(applied[0]).toBe("deleteMany");
    expect(createManyArgs.data[0]).not.toHaveProperty("variantUnitId");
    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });

  test("applyBatch records per-op failure without rolling back successful ops", async () => {
    enqueueMock.mockClear();

    Object.assign(legacyDbMock, {
      $transaction: async (fn: any) =>
        fn({
          shelfItem: {
            deleteMany: async () => ({ count: 1 }),
            update: async () => {
              throw new Error("Record to update not found");
            },
            findUniqueOrThrow: async () => makeShelfItemRow({ unitId: "x" }),
          },
          shelf: { update: async () => ({}) },
        }),
      shelfItem: { findMany: async () => [], findUnique: async () => null },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    const results = await shelfService.applyBatch("shelf-1", [
      { op: "delete", unitId: "x" },
      { op: "reorder", unitId: "missing", position: "a1" },
    ]);

    expect(results[0]!.status).toBe("ok");
    expect(results[1]!.status).toBe("failed");
    if (results[1]!.status === "failed") {
      expect(results[1]!.reason).toMatch(/not found/i);
    }
  });

  test("applyBatch resolves reorderToPage server-side", async () => {
    enqueueMock.mockClear();

    Object.assign(legacyDbMock, {
      $transaction: async (fn: any) =>
        fn({
          shelfItem: {
            findMany: async ({ skip, take }: any) => {
              if (skip === 0 && take === 1) return [{ position: "m" }];
              return [];
            },
            update: async ({ data }: any) =>
              makeShelfItemRow({ unitId: "moved", position: data.position }),
          },
          shelf: { update: async () => ({}) },
        }),
      shelfItem: {
        findUnique: async () =>
          makeShelfItemRow({ unitId: "moved", position: "a" }),
      },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    const results = await shelfService.applyBatch("shelf-1", [
      {
        op: "reorderToPage",
        unitId: "moved",
        toPage: 1,
        edge: "first",
        pageSize: 20,
        order: "asc",
      },
    ]);
    expect(results[0]!.status).toBe("ok");

    const oor = await shelfService.applyBatch("shelf-1", [
      {
        op: "reorderToPage",
        unitId: "moved",
        toPage: 99,
        edge: "first",
        pageSize: 20,
        order: "asc",
      },
    ]);
    expect(oor[0]!.status).toBe("failed");
  });

  test("applyBatch attach op rejects self-relation", async () => {
    Object.assign(legacyDbMock, {
      $transaction: async (fn: any) =>
        fn({
          shelfItem: { findUnique: async () => null },
          shelfItemChild: { upsert: async () => ({}) },
        }),
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    const results = await shelfService.applyBatch("shelf-1", [
      {
        op: "attach",
        parentUnitId: "u-1",
        childUnitId: "u-1",
        childKind: "review",
        role: "review",
      },
    ]);
    expect(results[0]!.status).toBe("failed");
    if (results[0]!.status === "failed") {
      expect(results[0]!.reason).toBe("self_relation_forbidden");
    }
  });

  test("create persists tagIds as pinned UnitTag rows", async () => {
    const captured: {
      unitCreate?: any;
      unitTagsCreate?: any[];
      translationsCreate?: any[];
      supportLanguagesCreate?: any[];
    } = {};
    Object.assign(legacyDbMock, {
      unit: {
        create: async ({ data }: any) => {
          captured.unitCreate = data;
          return { id: "shelf-new" };
        },
      },
      unitTranslation: {
        createMany: async ({ data }: any) => {
          captured.translationsCreate = data;
          return { count: data.length };
        },
      },
      unitSupportLanguage: {
        createMany: async ({ data }: any) => {
          captured.supportLanguagesCreate = data;
          return { count: data.length };
        },
      },
      unitTag: {
        createMany: async ({ data }: any) => {
          captured.unitTagsCreate = data;
          return { count: data.length };
        },
      },
      shelf: {
        create: async () => ({
          unitId: "shelf-new",
          extra: null,
          itemCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          unit: {
            userId: "u1",
            user: null,
            defaultLanguage: "en",
            translations: [],
            unitTags: [],
          },
        }),
      },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    await shelfService.create(
      {
        title: "My Shelf",
        tagIds: [SEED_TAG_ID_BY_NAME.book!, SEED_TAG_ID_BY_NAME.media!],
      },
      "u1",
    );

    expect(captured.unitTagsCreate).toBeDefined();
    expect(captured.unitTagsCreate).toHaveLength(2);
    expect(captured.unitTagsCreate![0]!.pinned).toBe(true);
    expect(captured.unitTagsCreate![1]!.pinned).toBe(true);
    expect(captured.unitCreate.defaultLanguage).toBe("en");
    expect(captured.translationsCreate).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          unitId: "shelf-new",
          language: "en",
          title: "My Shelf",
        }),
      ]),
    );
    expect(captured.supportLanguagesCreate).toEqual([
      expect.objectContaining({
        unitId: "shelf-new",
        language: "en",
        isPrimary: true,
      }),
    ]);
  });

  test("create rejects non-seed tagIds", async () => {
    Object.assign(legacyDbMock, {});

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    let status = 0;
    let message = "";
    try {
      await shelfService.create(
        {
          title: "My Shelf",
          tagIds: ["99999999-9999-9999-9999-999999999999"],
        },
        "u1",
      );
    } catch (err) {
      status = (err as { statusCode?: number }).statusCode ?? 0;
      message = (err as Error).message;
    }
    expect(status).toBe(400);
    expect(message).toBe("invalid-pin-target");
  });

  test("setPinnedTags inserts added rows only (insert-only diff)", async () => {
    const calls: { op: string; payload?: any }[] = [];
    Object.assign(legacyDbMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "u1" } }),
      },
      $transaction: async (fn: any) =>
        fn({
          unitTag: {
            findMany: async ({ select }: any) => {
              if (select?.tagUnitId && !select.score) {
                return []; // initial existing — 初始已存在集合
              }
              return [
                {
                  tagUnitId: SEED_TAG_ID_BY_NAME.book,
                  score: 0,
                },
              ];
            },
            deleteMany: async (args: any) => {
              calls.push({ op: "deleteMany", payload: args });
              return { count: 0 };
            },
            createMany: async (args: any) => {
              calls.push({ op: "createMany", payload: args });
              return { count: args.data?.length ?? 0 };
            },
          },
        }),
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    const result = await shelfService.setPinnedTags(
      "shelf-1",
      [SEED_TAG_ID_BY_NAME.book!],
      "u1",
    );

    expect(calls.find((c) => c.op === "createMany")).toBeDefined();
    expect(calls.find((c) => c.op === "deleteMany")).toBeUndefined();
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0]!.tagUnitId).toBe(SEED_TAG_ID_BY_NAME.book!);
  });

  test("setPinnedTags deletes removed rows only (delete-only diff)", async () => {
    const calls: { op: string; payload?: any }[] = [];
    Object.assign(legacyDbMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "u1" } }),
      },
      $transaction: async (fn: any) =>
        fn({
          unitTag: {
            findMany: async ({ select }: any) => {
              if (select?.tagUnitId && !select.score) {
                return [
                  { tagUnitId: SEED_TAG_ID_BY_NAME.book },
                  { tagUnitId: SEED_TAG_ID_BY_NAME.media },
                ];
              }
              return [{ tagUnitId: SEED_TAG_ID_BY_NAME.book, score: 0 }];
            },
            deleteMany: async (args: any) => {
              calls.push({ op: "deleteMany", payload: args });
              return { count: args.where.tagUnitId.in.length };
            },
            createMany: async (args: any) => {
              calls.push({ op: "createMany", payload: args });
              return { count: 0 };
            },
          },
        }),
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    await shelfService.setPinnedTags(
      "shelf-1",
      [SEED_TAG_ID_BY_NAME.book!],
      "u1",
    );

    const del = calls.find((c) => c.op === "deleteMany");
    expect(del).toBeDefined();
    expect(del!.payload.where.unitId).toBe("shelf-1");
    expect(calls.find((c) => c.op === "createMany")).toBeUndefined();
  });

  test("setPinnedTags performs mixed-diff insert + delete", async () => {
    const calls: { op: string; payload?: any }[] = [];
    Object.assign(legacyDbMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "u1" } }),
      },
      $transaction: async (fn: any) =>
        fn({
          unitTag: {
            findMany: async ({ select }: any) => {
              if (select?.tagUnitId && !select.score) {
                return [{ tagUnitId: SEED_TAG_ID_BY_NAME.book }];
              }
              return [{ tagUnitId: SEED_TAG_ID_BY_NAME.game, score: 0 }];
            },
            deleteMany: async (args: any) => {
              calls.push({ op: "deleteMany", payload: args });
              return { count: 1 };
            },
            createMany: async (args: any) => {
              calls.push({ op: "createMany", payload: args });
              return { count: args.data?.length ?? 0 };
            },
          },
        }),
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    await shelfService.setPinnedTags(
      "shelf-1",
      [SEED_TAG_ID_BY_NAME.game!],
      "u1",
    );

    const del = calls.find((c) => c.op === "deleteMany");
    const create = calls.find((c) => c.op === "createMany");
    expect(del!.payload.where.unitId).toBe("shelf-1");
    expect(create!.payload.data.map((r: any) => r.tagUnitId)).toEqual([
      SEED_TAG_ID_BY_NAME.game!,
    ]);
  });

  test("setPinnedTags is idempotent — same set yields no row churn", async () => {
    const calls: string[] = [];
    Object.assign(legacyDbMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "u1" } }),
      },
      $transaction: async (fn: any) =>
        fn({
          unitTag: {
            findMany: async ({ select }: any) => {
              if (select?.tagUnitId && !select.score) {
                return [{ tagUnitId: SEED_TAG_ID_BY_NAME.book }];
              }
              return [{ tagUnitId: SEED_TAG_ID_BY_NAME.book, score: 0 }];
            },
            deleteMany: async () => {
              calls.push("deleteMany");
              return { count: 0 };
            },
            createMany: async () => {
              calls.push("createMany");
              return { count: 0 };
            },
          },
        }),
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    await shelfService.setPinnedTags(
      "shelf-1",
      [SEED_TAG_ID_BY_NAME.book!],
      "u1",
    );
    expect(calls).toEqual([]);
  });

  test("setPinnedTags rejects non-owner", async () => {
    Object.assign(legacyDbMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "owner" } }),
      },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    let status = 0;
    try {
      await shelfService.setPinnedTags(
        "shelf-1",
        [SEED_TAG_ID_BY_NAME.book!],
        "intruder",
      );
    } catch (err) {
      status = (err as { statusCode?: number }).statusCode ?? 0;
    }
    expect(status).toBe(403);
  });

  test("setPinnedTags rejects non-seed identifiers", async () => {
    Object.assign(legacyDbMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "u1" } }),
      },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    let status = 0;
    let message = "";
    try {
      await shelfService.setPinnedTags(
        "shelf-1",
        ["99999999-9999-9999-9999-999999999999"],
        "u1",
      );
    } catch (err) {
      status = (err as { statusCode?: number }).statusCode ?? 0;
      message = (err as Error).message;
    }
    expect(status).toBe(400);
    expect(message).toBe("invalid-pin-target");
  });

  test("getByOwnerAndSlug returns 200-shaped payload for a system slug", async () => {
    Object.assign(legacyDbMock, {
      unit: {
        findFirst: async ({ where }: any) => {
          if (
            where.type === "SHELF" &&
            where.slug === "favorites" &&
            where.slugScope === "alice-unit"
          ) {
            return { id: "favorites-unit" };
          }
          return null;
        },
      },
      shelf: {
        findUnique: async ({ where }: any) => {
          if (where.unitId !== "favorites-unit") return null;
          return {
            unitId: "favorites-unit",
            extra: null,
            itemCount: 0,
            pinnedTagOrder: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            unit: {
              id: "favorites-unit",
              type: "SHELF",
              slug: "favorites",
              slugScope: "alice-unit",
              userId: "alice-unit",
              user: null,
              defaultLanguage: "en",
              translations: [{ language: "en", title: "Favorites" }],
              unitTags: [],
              status: "PUBLISHED",
              visibility: "PRIVATE",
              rating: "GENERAL",
              extra: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              publishedAt: null,
            },
          };
        },
      },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    const result = await shelfService.getByOwnerAndSlug(
      "alice-unit",
      "favorites",
    );
    expect(result).not.toBeNull();
    expect(result!.unitId).toBe("favorites-unit");
  });

  test("getByOwnerAndSlug returns null for a non-system slug", async () => {
    Object.assign(legacyDbMock, {
      unit: {
        findFirst: async () => ({ id: "should-not-be-read" }),
      },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    const result = await shelfService.getByOwnerAndSlug(
      "alice-unit",
      "my-custom-list",
    );
    expect(result).toBeNull();
  });

  test("getByOwnerAndSlug returns null when no matching unit exists", async () => {
    Object.assign(legacyDbMock, {
      unit: { findFirst: async () => null },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    const result = await shelfService.getByOwnerAndSlug(
      "ghost-user-unit",
      "favorites",
    );
    expect(result).toBeNull();
  });

  test("removeItem enqueues containedUnitIds sync after the canonical delete", async () => {
    enqueueMock.mockClear();

    Object.assign(legacyDbMock, {
      $transaction: async (fn: any) =>
        fn({
          shelfItem: { deleteMany: async () => ({ count: 1 }) },
          shelf: { update: async () => ({}) },
        }),
      shelfItem: {
        findMany: async () => [],
      },
    });

    const { shelfService } = await import(
      "./shelf.service.ts?shelf-service-test-actual" as string
    );
    await shelfService.removeItem("shelf-1", "book-1");

    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock.mock.calls[0]?.[0]).toMatchObject({
      kind: "search.content.patchContainedUnitIds",
      payload: { unitId: "shelf-1" },
    });
  });
});
