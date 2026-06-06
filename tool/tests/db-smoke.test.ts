import { describe, expect, test } from "bun:test";
import type { DbPreflightClient } from "../src/commands/db/preflight";
import { runDbSmokeChecks } from "../src/commands/db/smoke";

function createSmokeClient(
  overrides: Partial<Record<string, Record<string, unknown>[]>> = {},
): DbPreflightClient & { queries: string[] } {
  const queries: string[] = [];
  return {
    queries,
    async query(query: string) {
      queries.push(query);
      if (overrides[query]) return { rows: overrides[query] };
      if (query === "SHOW server_version_num") {
        return { rows: [{ server_version_num: "180000" }] };
      }
      if (query === "SELECT uuidv7()") return { rows: [{}] };
      if (query.includes("pg_extension")) {
        return { rows: [{ exists: true, can_create_extension: true }] };
      }
      if (query.includes("to_regclass")) {
        return { rows: [{ exists: true }] };
      }
      if (query.includes("uuid_extract_version")) {
        return { rows: [{ version: 7 }] };
      }
      if (query.includes("enum_range")) {
        return {
          rows: [{ values: "REVIEW,EXCERPT,REMARK,POST,CHAPTER,WIKI" }],
        };
      }
      if (query.includes("pg_indexes")) {
        return { rows: [{ exists: true }] };
      }
      throw new Error(`unexpected query: ${query}`);
    },
  };
}

describe("db migration smoke checks", () => {
  test("server checks extension, UUIDv7 extraction, enum values, tables, and raw-owned indexes", async () => {
    const client = createSmokeClient();

    await runDbSmokeChecks(client, "server");

    expect(client.queries.some((query) => query.includes("pg_extension"))).toBe(
      true,
    );
    expect(
      client.queries.some((query) => query.includes("uuid_extract_version")),
    ).toBe(true);
    expect(client.queries.some((query) => query.includes("enum_range"))).toBe(
      true,
    );
    for (const tableName of ["Unit", "Comment", "PollVote"]) {
      expect(
        client.queries.some((query) =>
          query.includes(`to_regclass('public."${tableName}"')`),
        ),
      ).toBe(true);
    }
    for (const indexName of [
      "Comment_rootUnitId_realmUnitId_parentCommentId_createdAt_id_idx",
      "PollVote_single_choice_uniq",
      "subscription_channels_gin",
    ]) {
      expect(client.queries.some((query) => query.includes(indexName))).toBe(
        true,
      );
    }
  });

  test("fails when a representative table is missing", async () => {
    const missingUnitQuery =
      "SELECT to_regclass('public.\"Unit\"') IS NOT NULL AS exists";
    const client = createSmokeClient({
      [missingUnitQuery]: [{ exists: false }],
    });

    await expect(runDbSmokeChecks(client, "server")).rejects.toThrow(
      "missing table Unit",
    );
  });

  test("non-server schema owners run preflight and table checks only", async () => {
    const client = createSmokeClient();

    await runDbSmokeChecks(client, "notify");

    expect(client.queries.some((query) => query.includes("Notification"))).toBe(
      true,
    );
    expect(client.queries.some((query) => query.includes("pg_extension"))).toBe(
      false,
    );
    expect(
      client.queries.some((query) => query.includes("uuid_extract_version")),
    ).toBe(false);
  });
});
