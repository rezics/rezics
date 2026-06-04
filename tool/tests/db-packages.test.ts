import { existsSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import {
  DB_MIGRATION_ORDER,
  resolveDbSchemaPackages,
} from "../src/commands/db/packages";
import {
  type DbPreflightClient,
  resolveDbConnectionUrl,
  runDbPreflightChecks,
} from "../src/commands/db/preflight";

function createPreflightClient(
  handler: (query: string) => Promise<Record<string, unknown>[]>,
): DbPreflightClient & { queries: string[] } {
  const queries: string[] = [];
  return {
    queries,
    async query(query: string) {
      queries.push(query);
      return { rows: await handler(query) };
    },
  };
}

describe("db package registry", () => {
  test("defaults to the proposal migration order", () => {
    expect(resolveDbSchemaPackages([]).packages).toEqual([
      ...DB_MIGRATION_ORDER,
    ]);
  });

  test("orders selected packages by migration order", () => {
    expect(
      resolveDbSchemaPackages(["ranking", "reaction", "auth"]).packages,
    ).toEqual(["auth", "reaction", "ranking"]);
  });

  test("separates ensure-only and unknown packages", () => {
    expect(resolveDbSchemaPackages(["job-runner", "nope"])).toEqual({
      packages: [],
      unknown: ["nope"],
      ensureOnly: ["job-runner"],
    });
  });

  test("does not keep a legacy Prisma db command path", () => {
    expect(existsSync(new URL("../src/commands/prisma", import.meta.url))).toBe(
      false,
    );
  });
});

describe("db preflight configuration", () => {
  test("uses process env before package .env values", () => {
    expect(
      resolveDbConnectionUrl(
        "server",
        { DATABASE_URL: "postgresql://process/server" } as never,
        { DATABASE_URL: "postgresql://package/server" },
      ),
    ).toBe("postgresql://process/server");
  });

  test("uses package-specific env keys", () => {
    expect(
      resolveDbConnectionUrl(
        "reaction",
        {},
        { REACTION_DATABASE_URL: "postgresql://package/reaction" },
      ),
    ).toBe("postgresql://package/reaction");
  });

  test("rejects malformed database URLs before connecting", () => {
    expect(() =>
      resolveDbConnectionUrl(
        "server",
        { DATABASE_URL: "https://example.test/rezics" },
        {},
      ),
    ).toThrow("DATABASE_URL must be a valid PostgreSQL connection URL");
  });
});

describe("db preflight checks", () => {
  test("rejects PostgreSQL versions before 18", async () => {
    const client = createPreflightClient(async () => [
      { server_version_num: "170006" },
    ]);

    await expect(
      runDbPreflightChecks(client, "server", "beforeMigration"),
    ).rejects.toThrow("PostgreSQL 18+ is required");
  });

  test("rejects databases without built-in uuidv7", async () => {
    const client = createPreflightClient(async (query) => {
      if (query === "SHOW server_version_num") {
        return [{ server_version_num: "180000" }];
      }
      throw Object.assign(new Error("function uuidv7 does not exist"), {
        code: "42883",
      });
    });

    await expect(
      runDbPreflightChecks(client, "auth", "beforeMigration"),
    ).rejects.toThrow("uuidv7() is unavailable");
  });

  test("requires ltree only for server after migrations", async () => {
    const client = createPreflightClient(async (query) => {
      if (query === "SHOW server_version_num") {
        return [{ server_version_num: "180000" }];
      }
      if (query === "SELECT uuidv7()") return [{}];
      return [{ exists: false }];
    });

    await expect(
      runDbPreflightChecks(client, "server", "afterMigration"),
    ).rejects.toThrow("ltree extension is missing after migrations");
  });

  test("surfaces missing ltree privilege before server migrations", async () => {
    const client = createPreflightClient(async (query) => {
      if (query === "SHOW server_version_num") {
        return [{ server_version_num: "180000" }];
      }
      if (query === "SELECT uuidv7()") return [{}];
      return [{ exists: false, can_create_extension: false }];
    });

    await expect(
      runDbPreflightChecks(client, "server", "beforeMigration"),
    ).rejects.toThrow("connected role cannot create extensions");
  });

  test("allows server migrations to create ltree when the role has privilege", async () => {
    const client = createPreflightClient(async (query) => {
      if (query === "SHOW server_version_num") {
        return [{ server_version_num: "180000" }];
      }
      if (query === "SELECT uuidv7()") return [{}];
      return [{ exists: false, can_create_extension: true }];
    });

    await runDbPreflightChecks(client, "server", "beforeMigration");
  });

  test("does not check ltree for non-server packages", async () => {
    const client = createPreflightClient(async (query) => {
      if (query === "SHOW server_version_num") {
        return [{ server_version_num: "180000" }];
      }
      if (query === "SELECT uuidv7()") return [{}];
      throw new Error(`unexpected query: ${query}`);
    });

    await runDbPreflightChecks(client, "ranking", "afterMigration");
    expect(client.queries).not.toContain(
      "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'ltree') AS exists",
    );
  });
});
