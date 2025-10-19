import {prisma} from '@/prisma/client';

/**
 * Get approximate count of Book
 * TODO ANALYZE "Book"; once per hour
 * @returns
 */
export async function getBookApproxCount() {
  const result = await prisma.$queryRaw<[{int8: bigint}]>`
    SELECT (reltuples / relpages * (pg_relation_size(oid) / 8192))::bigint
    FROM pg_class
    WHERE oid = '"Book"'::regclass;
  `;
  return Math.round(Number(result[0]?.int8 ?? 0));
}

// tsx -e "import('./books/sql.ts').then(async m => { const t=Date.now(); await m.getBookApproxCount(); console.log('耗时', Date.now()-t,'ms'); process.exit(); })"
