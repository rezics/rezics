import { describe, expect, mock, test } from "bun:test";
import { TAG_GROUPS, TAG_REGISTRY_LANGUAGES, TAGS } from "@rezics/contract";
import {
  EchoKV,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../../schema";
import { SEARCH_TAG_IDS_ECHOKV_KEY, seedSearchTagIds } from "./seed-tags";

function createExistingTagDb() {
  const slugs = Object.keys(TAGS);
  let selectIndex = 0;
  const calls = {
    inserts: [] as Array<{ table: unknown; value: any }>,
    updates: [] as Array<{ table: unknown; value: any }>,
    conflicts: [] as Array<{ table: unknown; input: any }>,
  };

  const db: any = {
    select: mock(() => ({
      from(table: unknown) {
        expect(table).toBe(Unit);
        return {
          where() {
            return {
              async limit(value: number) {
                expect(value).toBe(1);
                return [{ id: `tag-${slugs[selectIndex++]}`, type: "TAG" }];
              },
            };
          },
        };
      },
    })),
    update: mock((table: unknown) => ({
      set(value: any) {
        calls.updates.push({ table, value });
        return {
          async where() {},
        };
      },
    })),
    insert: mock((table: unknown) => ({
      values(value: any) {
        calls.inserts.push({ table, value });
        return {
          async onConflictDoUpdate(input: any) {
            calls.conflicts.push({ table, input });
          },
        };
      },
    })),
    transaction: mock(async () => {
      throw new Error("existing search tags should not create tag Units");
    }),
    calls,
  };

  return db;
}

describe("seedSearchTagIds", () => {
  test("syncs existing search tag translations and EchoKV through Drizzle", async () => {
    const db = createExistingTagDb();

    const result = await seedSearchTagIds(
      db as never,
      { tag: "tag-scope" } as never,
    );

    for (const [groupName, slugs] of Object.entries(TAG_GROUPS)) {
      expect(result[groupName as keyof typeof result]).toEqual(
        slugs.map((slug) => `tag-${slug}`),
      );
    }
    expect(db.transaction).not.toHaveBeenCalled();
    expect(
      db.calls.updates.filter((call: any) => call.table === Unit),
    ).toHaveLength(Object.keys(TAGS).length);
    expect(
      db.calls.inserts.filter((call: any) => call.table === UnitTranslation),
    ).toHaveLength(Object.keys(TAGS).length * TAG_REGISTRY_LANGUAGES.length);
    expect(
      db.calls.inserts.filter(
        (call: any) => call.table === UnitSupportLanguage,
      ),
    ).toHaveLength(Object.keys(TAGS).length * TAG_REGISTRY_LANGUAGES.length);

    const echoKvRows = db.calls.inserts.filter(
      (call: any) => call.table === EchoKV,
    );
    expect(echoKvRows).toHaveLength(1);
    expect(echoKvRows[0].value.key).toBe(SEARCH_TAG_IDS_ECHOKV_KEY);
    expect(db.calls.conflicts.some((call: any) => call.table === EchoKV)).toBe(
      true,
    );
  });

  test("does not import Prisma runtime or generated clients", async () => {
    const source = await Bun.file(
      new URL("./seed-tags.ts", import.meta.url),
    ).text();

    expect(source).not.toContain("@prisma/");
    expect(source).not.toContain("/prisma/");
    expect(source).not.toContain("generated/client");
  });
});
