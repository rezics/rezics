import { prisma } from "#/prisma/client";

const BATCH_SIZE = 10_000;

async function fetchBatch(
  cursor: string | null,
): Promise<{ unitId: string }[]> {
  const where = cursor
    ? { unitId: { gt: cursor } }
    : ({} as { unitId?: { gt: string } });
  return prisma.post.findMany({
    where: {
      ...where,
      rootPostUnitId: { not: null },
      OR: [{ rootTargetUnitId: null }, { rootTargetUnitType: null }],
    },
    select: { unitId: true },
    orderBy: { unitId: "asc" },
    take: BATCH_SIZE,
  });
}

try {
  let cursor: string | null = null;
  let totalUpdated = 0;
  let batchIndex = 0;

  while (true) {
    const batch = await fetchBatch(cursor);
    if (batch.length === 0) break;

    const ids = batch.map((row) => row.unitId);
    const updated = await prisma.$executeRaw`
      UPDATE "Post" AS p
      SET "rootTargetUnitId"   = r."targetUnitId",
          "rootTargetUnitType" = u."type"::text
      FROM "Post" AS r
      LEFT JOIN "Unit" AS u ON u."id" = r."targetUnitId"
      WHERE p."rootPostUnitId" = r."unitId"
        AND p."unitId" = ANY(${ids}::uuid[])
        AND ( p."rootTargetUnitId"   IS DISTINCT FROM r."targetUnitId"
           OR p."rootTargetUnitType" IS DISTINCT FROM u."type"::text );
    `;

    totalUpdated += Number(updated);
    cursor = ids[ids.length - 1] ?? cursor;
    batchIndex += 1;
    console.log(
      `[backfill-root-target] batch ${batchIndex}: scanned=${ids.length} updated=${Number(updated)} totalUpdated=${totalUpdated}`,
    );
  }

  console.log(`[backfill-root-target] done. totalUpdated=${totalUpdated}`);
} finally {
  await prisma.$disconnect();
}
