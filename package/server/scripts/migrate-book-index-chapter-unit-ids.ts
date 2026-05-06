import { prisma } from "#/prisma/client";
import { migrateLegacyBookIndexIds } from "@/book/book-index";

let scanned = 0;
let updated = 0;

try {
  const rows = await prisma.bookIndex.findMany({
    select: {
      bookUnitId: true,
      index: true,
    },
  });

  for (const row of rows) {
    scanned += 1;
    const nextIndex = await migrateLegacyBookIndexIds(row.index, prisma);
    if (JSON.stringify(nextIndex) === JSON.stringify(row.index)) continue;
    await prisma.bookIndex.update({
      where: { bookUnitId: row.bookUnitId },
      data: { index: nextIndex },
    });
    updated += 1;
  }

  console.log(JSON.stringify({ scanned, updated }, null, 2));
} finally {
  await prisma.$disconnect();
}
