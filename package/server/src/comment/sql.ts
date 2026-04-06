import { prisma } from "#/prisma/client";

/**
 * Get approximate count of comments (total CommentIndex rows)
 * Uses Postgres reltuples heuristic similar to book approximate count.
 */
export async function getCommentApproxCount() {
  const query: any = async () => {
    return await prisma.$queryRaw<[{ int8: bigint }]>`
    SELECT (reltuples / relpages * (pg_relation_size(oid) / 8192))::bigint
    FROM pg_class
    WHERE oid = '"CommentIndex"'::regclass;
  `;
  };
  let result: [{ int8: bigint }] | undefined;
  try {
    result = await query();
  } catch (error) {
    console.log(error);
    await prisma.$queryRaw`ANALYZE "CommentIndex";`;
    result = await query();
  }
  return Math.round(Number(result?.[0]?.int8 ?? 0));
}
