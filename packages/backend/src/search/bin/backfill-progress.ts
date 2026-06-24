/**
 * One-shot progress search backfill / drift repair.
 *
 * Invocation:
 *   cd packages/search && bun run src/bin/backfill-progress.ts
 *
 * The script is idempotent because each projected document uses the stable
 * `${userId}:${unitId}` primary key. It is resumable because it scans the
 * source table in primary-key order with no global lock; interrupting it only
 * leaves later rows to be processed by the next run.
 */

import { createServerDb } from "../../server/db/factory";
import { sql } from "drizzle-orm";
import { SearchClient, syncProgress, type UserUnitProgressRow } from "../index";

const BATCH_SIZE = 1000;

type ProgressQueryRow = UserUnitProgressRow & Record<string, unknown>;

const client = new SearchClient({
  host: process.env.MEILI_HOST ?? "http://localhost:7700",
  apiKey: process.env.MEILI_MASTER_KEY ?? "masterKey",
});

function resolveServerDatabaseUrl(): string {
  const url = process.env.SERVER_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "SERVER_DATABASE_URL or DATABASE_URL is required for progress backfill.",
    );
  }
  return url;
}

async function main(): Promise<void> {
  console.log("Initializing progress index settings...");
  await client.initProgressIndex();
  const serverDb = createServerDb(resolveServerDatabaseUrl());

  let cursor: { userId: string; unitId: string } | undefined;
  let total = 0;

  try {
    while (true) {
      const result = await serverDb.db.execute<ProgressQueryRow>(sql`
        select "userId", "unitId", "progress", "status", "lastSeenAt"
        from "UserUnitProgress"
        where "isDeleted" = false
          ${
            cursor
              ? sql`and ("userId", "unitId") > (${cursor.userId}, ${cursor.unitId})`
              : sql``
          }
        order by "userId" asc, "unitId" asc
        limit ${BATCH_SIZE}
      `);
      const rows = result.rows as UserUnitProgressRow[];

      if (rows.length === 0) break;

      for (const row of rows) {
        await syncProgress(client, row);
      }

      total += rows.length;
      const last = rows[rows.length - 1]!;
      cursor = { userId: last.userId, unitId: last.unitId };
      console.log("Backfilled progress rows", { total, cursor });
    }
  } finally {
    await serverDb.disconnect();
  }

  console.log("Progress backfill complete", { total });
}

main().catch((error) => {
  console.error("Progress backfill failed", error);
  process.exit(1);
});
