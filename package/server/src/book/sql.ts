import { sql } from "drizzle-orm";

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

type ApproxCountRow = { int8: bigint };

/**
 * Get approximate count of Book
 * TODO ANALYZE "Book"; once per hour
 * @returns
 */
export async function getBookApproxCount() {
  const db = await getServerDb();
  const query = async () => {
    const result = await db.execute<ApproxCountRow>(sql`
    SELECT (reltuples / relpages * (pg_relation_size(oid) / 8192))::bigint
    FROM pg_class
    WHERE oid = '"Book"'::regclass;
  `);
    return result.rows;
  };
  let result: ApproxCountRow[] | undefined;
  try {
    result = await query();
  } catch (error) {
    // const isDivisionByZero = error === '22012';
    console.log(error);
    await db.execute(sql`ANALYZE "Book";`);
    result = await query();
  }
  return Math.round(Number(result?.[0]?.int8 ?? 0));
}

// tsx -e "import('./books/sql.ts').then(async m => { const t=Date.now(); await m.getBookApproxCount(); console.log('耗时', Date.now()-t,'ms'); process.exit(); })"
