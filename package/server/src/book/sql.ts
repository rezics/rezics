import { prisma } from "#/prisma/client";

/**
 * Get approximate count of Book
 * TODO ANALYZE "Book"; once per hour
 * @returns
 */
export async function getBookApproxCount() {
  const query: any = async () => {
    return await prisma.$queryRaw<[{ int8: bigint }]>`
    SELECT (reltuples / relpages * (pg_relation_size(oid) / 8192))::bigint
    FROM pg_class
    WHERE oid = '"Book"'::regclass;
  `;
  };
  let result: [{ int8: bigint }] | undefined;
  try {
    result = await query();
  } catch (error) {
    // const isDivisionByZero = error === '22012';
    console.log(error);
    await prisma.$queryRaw`ANALYZE "Book";`;
    result = await query();
  }
  return Math.round(Number(result?.[0]?.int8 ?? 0));
}

// tsx -e "import('./books/sql.ts').then(async m => { const t=Date.now(); await m.getBookApproxCount(); console.log('耗时', Date.now()-t,'ms'); process.exit(); })"
