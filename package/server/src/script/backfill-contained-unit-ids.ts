import { prisma } from "#/prisma/client";
import { searchClient } from "@/meili/search-client";

const BATCH_SIZE = 5000;

interface BackfillRow {
  shelfUnitId: string;
  items: string[] | null;
}

async function fetchBatch(cursor: string | null): Promise<BackfillRow[]> {
  if (cursor === null) {
    return prisma.$queryRaw<BackfillRow[]>`
      SELECT u.id AS "shelfUnitId",
             ARRAY_REMOVE(ARRAY_AGG(si."itemRef"), NULL) AS "items"
      FROM "Unit" u
      LEFT JOIN "ShelfItem" si ON si."shelfUnitId" = u.id
      WHERE u.type = 'SHELF'
        AND u.status = 'PUBLISHED'
      GROUP BY u.id
      ORDER BY u.id ASC
      LIMIT ${BATCH_SIZE};
    `;
  }
  return prisma.$queryRaw<BackfillRow[]>`
    SELECT u.id AS "shelfUnitId",
           ARRAY_REMOVE(ARRAY_AGG(si."itemRef"), NULL) AS "items"
    FROM "Unit" u
    LEFT JOIN "ShelfItem" si ON si."shelfUnitId" = u.id
    WHERE u.type = 'SHELF'
      AND u.status = 'PUBLISHED'
      AND u.id > ${cursor}::uuid
    GROUP BY u.id
    ORDER BY u.id ASC
    LIMIT ${BATCH_SIZE};
  `;
}

try {
  let cursor: string | null = null;
  let total = 0;
  let batchIndex = 0;

  while (true) {
    const batch = await fetchBatch(cursor);
    if (batch.length === 0) break;

    await searchClient.patchContent(
      batch.map((row) => ({
        id: row.shelfUnitId,
        containedUnitIds: row.items ?? [],
      })),
    );

    total += batch.length;
    cursor = batch[batch.length - 1]!.shelfUnitId;
    batchIndex += 1;
    console.log(
      `[backfill-contained-unit-ids] batch ${batchIndex}: synced=${batch.length} total=${total}`,
    );
  }

  console.log(`[backfill-contained-unit-ids] done. total=${total}`);
} finally {
  await prisma.$disconnect();
}
