import { describe, expect, mock, test } from "bun:test";
import {
  parseZoneBoundary,
  parseZoneNav,
  parseZonePage,
  parseZoneTheme,
} from "@rezics/contract";
import {
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
  Zone,
  ZonePage,
} from "../../schema";
import {
  OFFICIAL_ZONE_DEFINITIONS,
  seedOfficialZones,
} from "./seed-official-zones";

type InsertCall = {
  table: unknown;
  value: any;
  conflict?: { target: unknown; set: Record<string, unknown> };
};

function makeDb(selectRows: unknown[][] = []) {
  const calls = {
    inserts: [] as InsertCall[],
    transactions: 0,
  };
  let nextUnitId = 0;

  const createSelect = () =>
    mock(() => ({
      from() {
        return {
          where() {
            return {
              async limit(value: number) {
                expect(value).toBe(1);
                return selectRows.shift() ?? [];
              },
            };
          },
        };
      },
    }));

  const createInsert = () =>
    mock((table: unknown) => {
      const call: InsertCall = { table, value: undefined };
      const builder = {
        values(value: any) {
          call.value = value;
          calls.inserts.push(call);
          return builder;
        },
        onConflictDoUpdate(input: {
          target: unknown;
          set: Record<string, unknown>;
        }) {
          call.conflict = input;
          return builder;
        },
        async returning() {
          return [{ id: `zone-${nextUnitId++}` }];
        },
        // biome-ignore lint/suspicious/noThenProperty: Drizzle insert doubles are awaitable.
        then(resolve: (value: unknown[]) => unknown) {
          return Promise.resolve([]).then(resolve);
        },
      };
      return builder;
    });

  const db: any = {
    select: createSelect(),
    insert: createInsert(),
    transaction: mock(async (callback: (tx: unknown) => Promise<string>) => {
      calls.transactions += 1;
      return callback({ insert: createInsert() });
    }),
    calls,
  };

  return db;
}

describe("seedOfficialZones", () => {
  test("frames Realms as a catalog library instead of trending discovery", () => {
    const realms = OFFICIAL_ZONE_DEFINITIONS.find(
      (definition) => definition.key === "realms",
    );
    expect(realms?.config.boundary.filters).toEqual({ types: ["REALM"] });
    expect(realms?.config.pages[0]?.config.sections).toMatchObject([
      { id: "hero", kind: "hero" },
      {
        id: "latest-realms",
        kind: "query",
        display: "carousel",
        query: { types: ["REALM"], sort: { field: "createdAt" } },
      },
      {
        id: "browse-realms",
        kind: "query",
        display: "tiles",
        loadMore: true,
        query: { types: ["REALM"], sort: { field: "qualityScore" } },
      },
      { id: "realm-updates", kind: "feed", feedKind: "updates" },
    ]);
  });

  test("frames Zones as a ZONE unit catalog led by recency", () => {
    const zones = OFFICIAL_ZONE_DEFINITIONS.find(
      (definition) => definition.key === "zones",
    );
    expect(zones?.slug).toBe("zones");
    expect(zones?.config.boundary.filters).toEqual({ types: ["ZONE"] });
    expect(zones?.config.pages[0]?.config.sections).toMatchObject([
      { id: "hero", kind: "hero" },
      {
        id: "latest-zones",
        kind: "query",
        display: "carousel",
        query: { types: ["ZONE"], sort: { field: "createdAt" } },
      },
      {
        id: "all-zones",
        kind: "query",
        display: "grid",
        loadMore: true,
        query: { types: ["ZONE"], sort: { field: "updatedAt" } },
      },
    ]);
  });

  test("creates official zones owned by the official realm", async () => {
    const db = makeDb(OFFICIAL_ZONE_DEFINITIONS.map(() => []));

    const result = await seedOfficialZones(db as never, "realm-rezics", {
      zone: "zone-scope",
    } as never);

    expect(result).toEqual({
      book: "zone-0",
      realms: "zone-1",
      zones: "zone-2",
      popular: "zone-3",
    });
    expect(db.calls.transactions).toBe(OFFICIAL_ZONE_DEFINITIONS.length);

    const unitInserts = db.calls.inserts.filter(
      (call: InsertCall) => call.table === Unit,
    );
    expect(unitInserts.map((call: InsertCall) => call.value.slug)).toEqual([
      "book",
      "realms",
      "zones",
      "popular",
    ]);
    expect(
      unitInserts.every(
        (call: InsertCall) =>
          call.value.type === "ZONE" && call.value.slugScope === "zone-scope",
      ),
    ).toBe(true);

    const zoneInserts = db.calls.inserts.filter(
      (call: InsertCall) => call.table === Zone,
    );
    expect(zoneInserts).toHaveLength(OFFICIAL_ZONE_DEFINITIONS.length);
    expect(
      zoneInserts.every(
        (call: InsertCall) =>
          call.value.ownerRealmUnitId === "realm-rezics" &&
          call.value.boundary?.schema === "rezics/zone-boundary" &&
          call.value.nav?.schema === "rezics/zone-nav" &&
          call.value.theme?.schema === "rezics/zone-theme" &&
          typeof call.value.homePageId === "string",
      ),
    ).toBe(true);

    const pageInserts = db.calls.inserts.filter(
      (call: InsertCall) => call.table === ZonePage,
    );
    expect(pageInserts).toHaveLength(OFFICIAL_ZONE_DEFINITIONS.length * 3);
    expect(
      pageInserts.every(
        (call: InsertCall) =>
          call.value.config?.schema === "rezics/zone-page" &&
          call.value.config?.version === 1,
      ),
    ).toBe(true);
  });

  test("keeps every official zone envelope contract-parseable", () => {
    for (const definition of OFFICIAL_ZONE_DEFINITIONS) {
      expect(parseZoneBoundary(definition.config.boundary)).toEqual(
        definition.config.boundary,
      );
      expect(parseZoneNav(definition.config.nav)).toEqual(
        definition.config.nav,
      );
      expect(parseZoneTheme(definition.config.theme)).toEqual(
        definition.config.theme,
      );
      for (const page of definition.config.pages) {
        expect(parseZonePage(page.config)).toEqual(page.config);
      }
    }
  });

  test("updates existing official zone rows idempotently", async () => {
    const db = makeDb([
      [{ id: "book-zone", type: "ZONE" }],
      [{ id: "realm-zone", type: "ZONE" }],
      [{ id: "zones-zone", type: "ZONE" }],
      [{ id: "popular-zone", type: "ZONE" }],
    ]);

    const result = await seedOfficialZones(db as never, "realm-rezics", {
      zone: "zone-scope",
    } as never);

    expect(result).toEqual({
      book: "book-zone",
      realms: "realm-zone",
      zones: "zones-zone",
      popular: "popular-zone",
    });
    expect(db.calls.transactions).toBe(0);

    const zoneInserts = db.calls.inserts.filter(
      (call: InsertCall) => call.table === Zone,
    );
    expect(zoneInserts).toHaveLength(OFFICIAL_ZONE_DEFINITIONS.length);
    expect(
      zoneInserts.every(
        (call: InsertCall) =>
          call.conflict &&
          call.conflict.set.ownerRealmUnitId === "realm-rezics" &&
          (call.conflict.set.boundary as { version?: number } | undefined)
            ?.version === 1 &&
          (call.conflict.set.nav as { version?: number } | undefined)
            ?.version === 1 &&
          (call.conflict.set.theme as { version?: number } | undefined)
            ?.version === 1,
      ),
    ).toBe(true);
  });

  test("rejects a deterministic official zone slug occupied by another unit type", async () => {
    const db = makeDb([[{ id: "book-id", type: "BOOK" }]]);

    await expect(
      seedOfficialZones(db as never, "realm-rezics", {
        zone: "zone-scope",
      } as never),
    ).rejects.toThrow(
      'Slug "book" under zone scope is already used by a non-ZONE unit',
    );
  });

  test("keeps localized titles and language rows idempotent", async () => {
    const db = makeDb(OFFICIAL_ZONE_DEFINITIONS.map(() => []));

    await seedOfficialZones(db as never, "realm-rezics", {
      zone: "zone-scope",
    } as never);

    const translationInserts = db.calls.inserts.filter(
      (call: InsertCall) => call.table === UnitTranslation,
    );
    const supportLanguageInserts = db.calls.inserts.filter(
      (call: InsertCall) => call.table === UnitSupportLanguage,
    );
    const expectedLanguageRows = OFFICIAL_ZONE_DEFINITIONS.reduce(
      (sum, definition) => sum + Object.keys(definition.translations).length,
      0,
    );

    expect(translationInserts).toHaveLength(expectedLanguageRows);
    expect(supportLanguageInserts).toHaveLength(expectedLanguageRows);
    expect(
      translationInserts.every((call: InsertCall) => Boolean(call.conflict)),
    ).toBe(true);
    expect(
      supportLanguageInserts.every((call: InsertCall) =>
        Boolean(call.conflict),
      ),
    ).toBe(true);
  });

  test("does not import Prisma runtime or generated clients", async () => {
    const source = await Bun.file(
      new URL("./seed-official-zones.ts", import.meta.url),
    ).text();

    expect(source).not.toContain("@prisma/");
    expect(source).not.toContain("/prisma/");
    expect(source).not.toContain("generated/client");
  });
});
