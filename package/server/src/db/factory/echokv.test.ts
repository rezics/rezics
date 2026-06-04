import { describe, expect, mock, test } from "bun:test";
import { EchoKV } from "../schema";
import { seedEchoKVWithDb } from "./echokv";

describe("seedEchoKVWithDb", () => {
  test("upserts home EchoKV rows through Drizzle", async () => {
    const calls: Array<{
      row: { key: string; value: unknown };
      target: unknown;
      set: Record<string, unknown>;
    }> = [];
    const db = {
      insert: mock((table: unknown) => {
        expect(table).toBe(EchoKV);
        return {
          values(row: { key: string; value: unknown }) {
            return {
              async onConflictDoUpdate(input: {
                target: unknown;
                set: Record<string, unknown>;
              }) {
                calls.push({ row, target: input.target, set: input.set });
              },
            };
          },
        };
      }),
    };

    await seedEchoKVWithDb(db as never);

    expect(calls.map((call) => call.row.key)).toEqual([
      "book_search_tag_group_quick",
      "home_carousel",
    ]);
    for (const call of calls) {
      expect(call.target).toBe(EchoKV.key);
      expect(call.set).toEqual({ value: call.row.value });
    }
  });
});
