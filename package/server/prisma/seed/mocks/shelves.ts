import { faker } from "@faker-js/faker";
import { DEFAULT_LANGUAGE, withCoverUrl } from "@rezics/contract";
import type { Prisma, PrismaClient } from "#/prisma/generated/client.js";
import { UnitStatus, UnitType } from "#/prisma/generated/client.js";
import { generateBetween } from "@/shelf/fractional-index";
import { getRandomShelfCover, SHELF_KIND_KEYS } from "./data.js";
import { generateTranslations } from "./generators.js";
import type { CreatedPost, CreatedUnit, CreatedUser } from "./types.js";
import {
  chunkedParallel,
  pickN,
  powerLaw,
  randomBoolean,
  randomInt,
  unitTypeToShelfKind,
} from "./utils.js";

const CHUNK_SIZE = 10;

/**
 * Seed shelves (replaces ReadList).
 * Each shelf = Unit(type=SHELF) + Shelf extension + UnitTranslation + ShelfItems.
 */
export async function seedShelves(
  prisma: PrismaClient,
  total: number,
  users: CreatedUser[],
  works: CreatedUnit[],
  reviewPosts: CreatedPost[],
): Promise<CreatedUnit[]> {
  if (works.length < 3) {
    console.warn(
      "[Seed] Not enough works to seed shelves (need >= 3). Skipping.",
    );
    return [];
  }

  console.log(`[Seed] Seeding ${total} shelves...`);

  // Index reviews by targetUnitId so we can attach multiple reviews per slot.
  const reviewsByTarget = new Map<string, CreatedPost[]>();
  for (const r of reviewPosts) {
    if (!r.targetUnitId) continue;
    const bucket = reviewsByTarget.get(r.targetUnitId);
    if (bucket) bucket.push(r);
    else reviewsByTarget.set(r.targetUnitId, [r]);
  }

  return chunkedParallel(
    Array.from({ length: total }),
    CHUNK_SIZE,
    async () => {
      const author = faker.helpers.arrayElement(users);
      const translations = generateTranslations(UnitType.SHELF);
      const kindKey = faker.helpers.arrayElement([...SHELF_KIND_KEYS]);
      const coverUrl = randomBoolean(0.7) ? getRandomShelfCover() : null;

      const extra = randomBoolean(0.3)
        ? {
            sortBy: faker.helpers.arrayElement(["manual", "time", "title"]),
            viewMode: faker.helpers.arrayElement(["grid", "list", "review"]),
            theme: faker.helpers.arrayElement(["default", "dark", "accent"]),
          }
        : null;

      const unit = await prisma.unit.create({
        data: {
          type: UnitType.SHELF,
          userId: author.unitId,
          status: randomBoolean(0.9) ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
          defaultLanguage: DEFAULT_LANGUAGE,
          publishedAt: randomBoolean(0.85)
            ? faker.date.past({ years: 2 })
            : null,
          shelf: {
            create: {
              kindKey,
              extra: extra ?? undefined,
            },
          },
          translations: {
            create: translations.map((t) => ({
              language: t.language,
              title: t.title,
              description: t.description,
              extra:
                coverUrl && t.language === DEFAULT_LANGUAGE
                  ? (withCoverUrl(undefined, coverUrl) as Prisma.InputJsonValue)
                  : undefined,
            })),
          },
          supportLanguages: {
            create: translations.map((t, i) => ({
              language: t.language,
              isPrimary: i === 0,
              sortOrder: i,
            })),
          },
        },
        select: { id: true, type: true },
      });

      const itemCount = Math.min(powerLaw(3, 150, 1.5), works.length);
      const selectedWorks = pickN(works, itemCount);

      let prevPos: string | undefined;
      const shelfItemRows: Array<{
        shelfUnitId: string;
        itemRef: string;
        kind: string;
        position: string;
      }> = [];
      const shelfUnitRows: Array<{
        shelfUnitId: string;
        itemRef: string;
        unitId: string;
        role: string;
      }> = [];

      for (const work of selectedWorks) {
        const position = generateBetween(prevPos, undefined);
        prevPos = position;
        shelfItemRows.push({
          shelfUnitId: unit.id,
          itemRef: work.id,
          kind: unitTypeToShelfKind(work.type),
          position,
        });
        shelfUnitRows.push({
          shelfUnitId: unit.id,
          itemRef: work.id,
          unitId: work.id,
          role: "primary",
        });

        // Attach multiple reviews per slot when available (showcase book→many-review).
        const candidateReviews = reviewsByTarget.get(work.id);
        if (candidateReviews && candidateReviews.length > 0) {
          const attachCount = Math.min(
            randomInt(1, 3),
            candidateReviews.length,
          );
          if (randomBoolean(0.6)) {
            for (const review of pickN(candidateReviews, attachCount)) {
              shelfUnitRows.push({
                shelfUnitId: unit.id,
                itemRef: work.id,
                unitId: review.id,
                role: "review",
              });
            }
          }
        }
      }

      if (shelfItemRows.length > 0) {
        await prisma.shelfItem.createMany({ data: shelfItemRows });
        await prisma.shelfUnit.createMany({
          data: shelfUnitRows,
          skipDuplicates: true,
        });
      }

      return unit;
    },
  );
}
