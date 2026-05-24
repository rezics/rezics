import { Prisma, prisma } from "#/prisma/client";
import { repairRichDescriptionValue } from "@/content-doc/repair-rich-description";

type UserDescriptionRow = {
  unitId: string;
  description: unknown;
};

type UnitTranslationDescriptionRow = {
  unitId: string;
  language: string;
  description: unknown;
};

async function repairUserDescriptions(): Promise<number> {
  const rows = await prisma.$queryRaw<UserDescriptionRow[]>`
    SELECT "unitId", "description"
    FROM "User"
    WHERE jsonb_typeof("description") = 'string'
    ORDER BY "unitId" ASC;
  `;

  for (const row of rows) {
    const repaired = repairRichDescriptionValue(row.description);
    await prisma.user.update({
      where: { unitId: row.unitId },
      data: {
        description:
          repaired === null
            ? Prisma.JsonNull
            : (repaired as Prisma.InputJsonValue),
      },
    });
  }

  return rows.length;
}

async function repairUnitTranslationDescriptions(): Promise<number> {
  const rows = await prisma.$queryRaw<UnitTranslationDescriptionRow[]>`
    SELECT "unitId", "language", "description"
    FROM "UnitTranslation"
    WHERE jsonb_typeof("description") = 'string'
    ORDER BY "unitId" ASC, "language" ASC;
  `;

  for (const row of rows) {
    const repaired = repairRichDescriptionValue(row.description);
    await prisma.unitTranslation.update({
      where: {
        unitId_language: { unitId: row.unitId, language: row.language },
      },
      data: {
        description:
          repaired === null
            ? Prisma.JsonNull
            : (repaired as Prisma.InputJsonValue),
      },
    });
  }

  return rows.length;
}

try {
  const [users, translations] = await Promise.all([
    repairUserDescriptions(),
    repairUnitTranslationDescriptions(),
  ]);
  console.log(
    `[repair-content-doc-descriptions] repaired users=${users} unitTranslations=${translations}`,
  );
  console.log(
    "[repair-content-doc-descriptions] refresh search with: bun --filter=@rezics/server run seed:init-meili-search",
  );
} finally {
  await prisma.$disconnect();
}
