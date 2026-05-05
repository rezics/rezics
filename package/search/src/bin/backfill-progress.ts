/**
 * One-shot progress search backfill / drift repair.
 *
 * Invocation:
 *   cd package/search && bun run src/bin/backfill-progress.ts
 *
 * The script is idempotent because each projected document uses the stable
 * `${userId}:${unitId}` primary key. It is resumable because it scans the
 * source table in primary-key order with no global lock; interrupting it only
 * leaves later rows to be processed by the next run.
 */
import { prisma } from "@rezics/server";
import { SearchClient, syncProgress } from "../index";

const BATCH_SIZE = 1000;

const client = new SearchClient({
  host: process.env.MEILI_HOST ?? "http://localhost:7700",
  apiKey: process.env.MEILI_MASTER_KEY ?? "masterKey",
});

async function main(): Promise<void> {
  console.log("Initializing progress index settings...");
  await client.initProgressIndex();

  let cursor: { userId: string; unitId: string } | undefined;
  let total = 0;

  while (true) {
    const rows = await prisma.userUnitProgress.findMany({
      orderBy: [{ userId: "asc" }, { unitId: "asc" }],
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { userId_unitId: cursor } : undefined,
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      await syncProgress(client, row);
    }

    total += rows.length;
    const last = rows[rows.length - 1]!;
    cursor = { userId: last.userId, unitId: last.unitId };
    console.log("Backfilled progress rows", { total, cursor });
  }

  console.log("Progress backfill complete", { total });
}

main().catch((error) => {
  console.error("Progress backfill failed", error);
  process.exit(1);
});
