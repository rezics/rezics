/**
 * Database Reset Script
 *
 * Resets mock data from the server database. By default, preserves
 * cross-seeded infrastructure so `bun run seed` does not need to be rerun.
 *
 * **Infrastructure** (preserved by default):
 * - Seed users (root, admin, regular, blocked)
 * - Content-type tags (Book, Game, Media, Post, Link)
 * - Official realm + owner membership
 * - EchoKV entries with `infra:` prefix
 *
 * **Flags:**
 * - `--all`  Full wipe — deletes everything including infrastructure.
 *            Requires `bun run seed` to be rerun before mock seeding.
 *
 * **Usage:**
 * ```
 * bun run seed:database-reset          # preserve infrastructure
 * bun run seed:database-reset --all    # full wipe
 * bun run seed:database-reset:all      # alias for --all
 * ```
 */
import { prisma } from "../../client";
import { resetDatabase, resetDatabasePreserveInfra } from "../database";

const wipeAll = process.argv.includes("--all");

async function main() {
  if (wipeAll) {
    console.log("[Reset] Full wipe mode (--all)");
    await resetDatabase(prisma);
  } else {
    console.log("[Reset] Preserving infrastructure (default)");
    await resetDatabasePreserveInfra(prisma);
  }
}

main()
  .catch((err) => {
    console.error("Failed to reset database:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
