import { sql } from "drizzle-orm";

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

type ApproxCountRow = { int8: bigint };

/**
 * Get approximate count of Unit using pg_class reltuples heuristic
 * This is fast for large tables but may be slightly off.
 */
export async function getUnitApproxCount() {
  const db = await getServerDb();
  const query = async () => {
    const result = await db.execute<ApproxCountRow>(sql`
    SELECT (reltuples / relpages * (pg_relation_size(oid) / 8192))::bigint
    FROM pg_class
    WHERE oid = '"Unit"'::regclass;
  `);
    return result.rows;
  };
  let result: ApproxCountRow[] | undefined;
  try {
    result = await query();
  } catch (_err) {
    await db.execute(sql`ANALYZE "Unit";`);
    result = await query();
  }
  return Math.round(Number(result?.[0]?.int8 ?? 0));
}
