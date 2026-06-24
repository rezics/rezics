/**
 * One-shot entity search backfill / drift repair.
 *
 * Invocation:
 *   cd packages/search && bun run src/bin/backfill-entities.ts
 *
 * The script is idempotent because each projected document uses the stable
 * `Unit.id` primary key. It is resumable because it scans the source table in
 * primary-key order with no global lock; interrupting it only leaves later
 * rows to be processed by the next run.
 */
import { SearchClient, syncAllEntities } from "../index";

const client = new SearchClient({
  host: process.env.MEILI_HOST ?? "http://localhost:7700",
  apiKey: process.env.MEILI_MASTER_KEY ?? "masterKey",
});

async function main(): Promise<void> {
  console.log("Initializing entity index settings...");
  await client.initEntityIndex();

  const result = await syncAllEntities(client);
  console.log("Entity backfill complete", result);
}

main().catch((error) => {
  console.error("Entity backfill failed", error);
  process.exit(1);
});
