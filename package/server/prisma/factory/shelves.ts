import { faker } from "@faker-js/faker";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  withCoverUrl,
} from "@rezics/contract";
import { generateBetween } from "../../src/shelf/fractional-index";
import type { Prisma } from "../generated/client.js";
import { UnitStatus, UnitType } from "../generated/client.js";
import { getRandomShelfCover, SHELF_KIND_KEYS } from "./data.js";
import { generateTranslations } from "./generators.js";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type { CreatedPost, CreatedUnit, CreatedUser } from "./types.js";
import {
  chunkedParallel,
  pickN,
  randomBoolean,
  randomInt,
  unitTypeToShelfKind,
} from "./utils.js";

const CHUNK_SIZE = 10;

interface ShelvesPlan {
  shelves: CountSpec;
  shelfItemCount: CountSpec;
}

/**
 * Seed shelves (replaces ReadList).
 * Each shelf = Unit(type=SHELF) + Shelf extension + UnitTranslation + ShelfItems.
 */
export async function seedShelves(
  ctx: SeedCtx,
  plan: ShelvesPlan,
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

  const total = ctx.draw(plan.shelves);
  console.log(`[Seed] Seeding ${total} shelves...`);

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
            viewMode: faker.helpers.arrayElement(["nested", "flat", "masonry"]),
            theme: faker.helpers.arrayElement(["default", "dark", "accent"]),
          }
        : null;

      const unit = await ctx.prisma.unit.create({
        data: {
          type: UnitType.SHELF,
          userId: author.userId,
          slugScope: author.userId,
          status: randomBoolean(0.9) ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
          licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
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

      const itemCount = Math.min(ctx.draw(plan.shelfItemCount), works.length);
      const selectedWorks = pickN(works, itemCount);

      let prevPos: string | undefined;
      const shelfUnitRows: Array<{
        shelfId: string;
        unitId: string;
        kind: string;
        position: string;
      }> = [];
      const shelfUnitRelationRows: Array<{
        shelfId: string;
        parentUnitId: string;
        childUnitId: string;
        role: string;
      }> = [];

      for (const work of selectedWorks) {
        const position = generateBetween(prevPos, undefined);
        prevPos = position;
        shelfUnitRows.push({
          shelfId: unit.id,
          unitId: work.id,
          kind: unitTypeToShelfKind(work.type),
          position,
        });

        const candidateReviews = reviewsByTarget.get(work.id);
        if (candidateReviews && candidateReviews.length > 0) {
          const attachCount = Math.min(
            randomInt(1, 3),
            candidateReviews.length,
          );
          if (randomBoolean(0.6)) {
            for (const review of pickN(candidateReviews, attachCount)) {
              const reviewPosition = generateBetween(prevPos, undefined);
              prevPos = reviewPosition;
              shelfUnitRows.push({
                shelfId: unit.id,
                unitId: review.id,
                kind: "review",
                position: reviewPosition,
              });
              shelfUnitRelationRows.push({
                shelfId: unit.id,
                parentUnitId: work.id,
                childUnitId: review.id,
                role: "review",
              });
            }
          }
        }
      }

      if (shelfUnitRows.length > 0) {
        await ctx.prisma.shelfUnit.createMany({
          data: shelfUnitRows,
          skipDuplicates: true,
        });
        if (shelfUnitRelationRows.length > 0) {
          await ctx.prisma.shelfUnitRelation.createMany({
            data: shelfUnitRelationRows,
            skipDuplicates: true,
          });
        }
        await ctx.prisma.shelf.update({
          where: { unitId: unit.id },
          data: { itemCount: shelfUnitRows.length },
        });
      }

      await ctx.sync.content(unit.id);
      await ctx.sync.contentContainedUnits(unit.id);

      return unit;
    },
  );
}
