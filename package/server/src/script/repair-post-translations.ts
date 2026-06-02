import { DEFAULT_LANGUAGE } from "@rezics/contract";
import { Prisma, prisma } from "#/prisma/client";

type LegacyPostTranslationRow = {
  unitId: string;
  defaultLanguage: string | null;
  primaryLanguage: string | null;
  firstLanguage: string | null;
  legacyTitle: string | null;
  content: unknown;
  status: string;
  authorUserId: string;
};

function languageFor(row: LegacyPostTranslationRow): string {
  return (
    row.defaultLanguage ??
    row.primaryLanguage ??
    row.firstLanguage ??
    DEFAULT_LANGUAGE
  );
}

async function repairPostTranslations(): Promise<{
  titles: number;
  bodies: number;
}> {
  const rows = await prisma.$queryRaw<LegacyPostTranslationRow[]>`
    SELECT
      p."unitId",
      u."defaultLanguage",
      primary_lang."language" AS "primaryLanguage",
      first_lang."language" AS "firstLanguage",
      p."extra"->>'title' AS "legacyTitle",
      p."content",
      u."status",
      p."authorUserId"
    FROM "Post" p
    JOIN "Unit" u ON u."id" = p."unitId"
    LEFT JOIN LATERAL (
      SELECT usl."language"
      FROM "UnitSupportLanguage" usl
      WHERE usl."unitId" = p."unitId" AND usl."isPrimary" = true
      ORDER BY usl."sortOrder" ASC
      LIMIT 1
    ) primary_lang ON true
    LEFT JOIN LATERAL (
      SELECT usl."language"
      FROM "UnitSupportLanguage" usl
      WHERE usl."unitId" = p."unitId"
      ORDER BY usl."sortOrder" ASC
      LIMIT 1
    ) first_lang ON true
    WHERE
      (p."extra" ? 'title' OR p."content" IS NOT NULL)
    ORDER BY p."unitId" ASC;
  `;

  let titles = 0;
  let bodies = 0;
  for (const row of rows) {
    const language = languageFor(row);
    await prisma.unit.update({
      where: { id: row.unitId },
      data: {
        defaultLanguage: row.defaultLanguage ?? language,
        supportLanguages: {
          upsert: {
            where: { unitId_language: { unitId: row.unitId, language } },
            create: { language, isPrimary: true },
            update: {},
          },
        },
      },
    });

    if (row.legacyTitle?.trim()) {
      await prisma.unitTranslation.upsert({
        where: { unitId_language: { unitId: row.unitId, language } },
        create: {
          unitId: row.unitId,
          language,
          title: row.legacyTitle.trim(),
        },
        update: { title: row.legacyTitle.trim() },
      });
      titles += 1;
    }

    if (row.content !== null && row.content !== undefined) {
      await prisma.contentTranslation.upsert({
        where: { unitId_language: { unitId: row.unitId, language } },
        create: {
          unitId: row.unitId,
          language,
          content: row.content as Prisma.InputJsonValue,
          status: row.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
          authorUserId: row.authorUserId,
          provenance: { source: "post-content-repair" },
        },
        update: {
          content: row.content as Prisma.InputJsonValue,
          status: row.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
          authorUserId: row.authorUserId,
          provenance: { source: "post-content-repair" },
        },
      });
      bodies += 1;
    }
  }
  return { titles, bodies };
}

try {
  const result = await repairPostTranslations();
  console.log(
    `[repair-post-translations] repaired titles=${result.titles} bodies=${result.bodies}`,
  );
  console.log(
    "[repair-post-translations] refresh search with: bun --filter=@rezics/server run seed:init-meili-search",
  );
} finally {
  await prisma.$disconnect();
}
