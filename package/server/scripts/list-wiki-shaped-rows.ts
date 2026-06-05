import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, disconnectServerDb } from "@/db/client";
import { Unit, UnitTranslation, User } from "@/db/schema";
import { REZICS_WIKI_USER_SLUG } from "@/infra/infra-users";

type WikiShapedRow = {
  id: string;
  type: string;
  slug: string | null;
  status: string;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
  translations: Array<{ language: string; title: string | null }>;
};

try {
  const [wikiUser] = await db
    .select({ unitId: User.unitId })
    .from(User)
    .innerJoin(Unit, eq(Unit.id, User.unitId))
    .where(eq(Unit.slug, REZICS_WIKI_USER_SLUG))
    .limit(1);

  if (!wikiUser) {
    console.log(JSON.stringify({ rezicsWikiUserId: null, rows: [] }, null, 2));
  } else {
    const joinedRows = await db
      .select({
        id: Unit.id,
        type: Unit.type,
        slug: Unit.slug,
        status: Unit.status,
        visibility: Unit.visibility,
        createdAt: Unit.createdAt,
        updatedAt: Unit.updatedAt,
        translationLanguage: UnitTranslation.language,
        translationTitle: UnitTranslation.title,
      })
      .from(Unit)
      .leftJoin(UnitTranslation, eq(UnitTranslation.unitId, Unit.id))
      .where(
        and(
          eq(Unit.userId, wikiUser.unitId),
          inArray(Unit.type, ["BOOK", "ENTITY", "GAME", "MEDIA", "POST"]),
        ),
      )
      .orderBy(
        asc(Unit.type),
        desc(Unit.createdAt),
        asc(UnitTranslation.language),
      );

    const rows: WikiShapedRow[] = [];
    const seenUnitIds = new Set<string>();
    for (const row of joinedRows) {
      if (seenUnitIds.has(row.id)) continue;
      seenUnitIds.add(row.id);
      rows.push({
        id: row.id,
        type: row.type,
        slug: row.slug,
        status: row.status,
        visibility: row.visibility,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        translations:
          row.translationLanguage === null
            ? []
            : [
                {
                  language: row.translationLanguage,
                  title: row.translationTitle,
                },
              ],
      });
    }

    console.log(
      JSON.stringify(
        {
          rezicsWikiUserId: wikiUser.unitId,
          count: rows.length,
          rows,
        },
        null,
        2,
      ),
    );
  }
} finally {
  await disconnectServerDb();
}
