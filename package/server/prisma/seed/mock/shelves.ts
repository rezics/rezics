import { faker } from "@faker-js/faker";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import type { PrismaClient } from "#/prisma/generated/client.js";
import { UnitStatus, UnitType } from "#/prisma/generated/client.js";
import { SHELF_KIND_KEYS } from "./data.js";
import { generateTranslations } from "./generators.js";
import type { CreatedPost, CreatedUnit, CreatedUser } from "./types.js";
import { chunkedParallel, pickN, randomBoolean, randomInt } from "./utils.js";

const CHUNK_SIZE = 10;

/**
 * Seed shelves (replaces ReadList).
 * Each shelf = Unit(type=SHELF) + Shelf extension + UnitTranslation + ShelfItems.
 */
export async function seedShelves(
  prisma: PrismaClient,
  total: number,
  users: CreatedUser[],
  workIds: string[],
  reviewPosts: CreatedPost[],
): Promise<CreatedUnit[]> {
  if (workIds.length < 3) {
    console.warn("[Seed] Not enough works to seed shelves (need >= 3). Skipping.");
    return [];
  }

  console.log(`[Seed] Seeding ${total} shelves...`);

  return chunkedParallel(
    Array.from({ length: total }),
    CHUNK_SIZE,
    async () => {
      const author = faker.helpers.arrayElement(users);
      const translations = generateTranslations(UnitType.SHELF);
      const kindKey = faker.helpers.arrayElement([...SHELF_KIND_KEYS]);

      const unit = await prisma.unit.create({
        data: {
          type: UnitType.SHELF,
          userId: author.unitId,
          status: randomBoolean(0.9) ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
          defaultLanguage: DEFAULT_LANGUAGE,
          publishedAt: randomBoolean(0.85) ? faker.date.past({ years: 2 }) : null,
          shelf: {
            create: { kindKey },
          },
          translations: {
            create: translations.map((t) => ({
              language: t.language,
              title: t.title,
              description: t.description,
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

      // Add items to shelf
      const itemCount = randomInt(3, Math.min(10, workIds.length));
      const selectedWorks = pickN(workIds, itemCount);

      const shelfItems = selectedWorks.map((workId, i) => ({
        shelfUnitId: unit.id,
        itemUnitId: workId,
        sortOrder: i,
        keywords: randomBoolean(0.3)
          ? faker.helpers.arrayElements(
              ["to-read", "favorite", "reference", "gift-idea", "summer", "classic"],
              { min: 1, max: 3 },
            )
          : [],
        label: randomBoolean(0.2) ? faker.lorem.words({ min: 1, max: 3 }) : null,
      }));

      if (shelfItems.length > 0) {
        await prisma.shelfItem.createMany({ data: shelfItems });
      }

      // Optionally attach reviews via ShelfItemReview junction
      if (reviewPosts.length > 0) {
        const reviewAttachments = shelfItems
          .filter(() => randomBoolean(0.3))
          .map((item) => {
            const review = reviewPosts.find((p) => p.targetUnitId === item.itemUnitId);
            return review
              ? {
                  shelfUnitId: unit.id,
                  itemUnitId: item.itemUnitId,
                  reviewUnitId: review.id,
                }
              : null;
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        if (reviewAttachments.length > 0) {
          await prisma.shelfItemReview.createMany({
            data: reviewAttachments,
            skipDuplicates: true,
          });
        }
      }

      return unit;
    },
  );
}
