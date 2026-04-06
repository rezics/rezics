import { prisma } from "#/prisma/client";

/**
 * Get approximate count of Unit using pg_class reltuples heuristic
 * This is fast for large tables but may be slightly off.
 */
export async function getUnitApproxCount() {
  const query: any = async () => {
    return await prisma.$queryRaw<[{ int8: bigint }]>`
    SELECT (reltuples / relpages * (pg_relation_size(oid) / 8192))::bigint
    FROM pg_class
    WHERE oid = '"Unit"'::regclass;
  `;
  };
  let result: [{ int8: bigint }] | undefined;
  try {
    result = await query();
  } catch (_err) {
    await prisma.$queryRaw`ANALYZE "Unit";`;
    result = await query();
  }
  return Math.round(Number(result?.[0]?.int8 ?? 0));
}
