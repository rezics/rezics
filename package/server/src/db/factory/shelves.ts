import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  withCoverUrl,
} from "@rezics/contract";
import { generateBetween, rebalance } from "../../shelf/fractional-index";
import {
  Shelf,
  ShelfItem,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../schema";
import { getRandomShelfCover, SHELF_KIND_KEYS } from "./data.js";
import { generateTranslations } from "./generators.js";
import { UnitStatus, UnitType } from "./storage-values.js";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type { CreatedPost, CreatedUnit, CreatedUser } from "./types.js";
import {
  chunkedParallel,
  pickN,
  randomBoolean,
  randomInt,
  unitTypeToShelfKind,
  withUpdatedAt,
  withUpdatedAtRows,
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

      const unit = { id: randomUUID(), type: UnitType.SHELF };

      const itemCount = Math.min(ctx.draw(plan.shelfItemCount), works.length);
      const selectedWorks = pickN(works, itemCount);

      let prevPos: string | undefined;
      const shelfItemRows: Array<{
        shelfId: string;
        itemType: string;
        itemId: string;
        kind: string;
        position: string;
        parentItemType?: string;
        parentItemId?: string;
        parentRole?: string;
      }> = [];
      for (const work of selectedWorks) {
        const position = generateBetween(prevPos, undefined);
        prevPos = position;
        shelfItemRows.push({
          shelfId: unit.id,
          itemType: "unit",
          itemId: work.id,
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
              shelfItemRows.push({
                shelfId: unit.id,
                itemType: "unit",
                itemId: review.id,
                kind: "review",
                position: reviewPosition,
                parentItemId: work.id,
                parentItemType: "unit",
                parentRole: "review",
              });
            }
          }
        }
      }

      await ctx.db.insert(Unit).values(
        withUpdatedAt({
          id: unit.id,
          type: UnitType.SHELF,
          userId: author.userId,
          slugScope: author.userId,
          status: randomBoolean(0.9) ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
          licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
          defaultLanguage: DEFAULT_LANGUAGE,
          publishedAt: randomBoolean(0.85)
            ? faker.date.past({ years: 2 })
            : null,
        }),
      );
      await ctx.db.insert(Shelf).values(
        withUpdatedAt({
          unitId: unit.id,
          kindKey,
          extra,
          rootItemCount: selectedWorks.length,
          itemCount: shelfItemRows.length,
        }),
      );
      await ctx.db.insert(UnitTranslation).values(
        withUpdatedAtRows(
          translations.map((t) => ({
            unitId: unit.id,
            language: t.language,
            title: t.title,
            description: t.description,
            extra:
              coverUrl && t.language === DEFAULT_LANGUAGE
                ? (withCoverUrl(undefined, coverUrl) as unknown)
                : undefined,
          })),
        ),
      );
      await ctx.db.insert(UnitSupportLanguage).values(
        withUpdatedAtRows(
          translations.map((t, i) => ({
            unitId: unit.id,
            language: t.language,
            isPrimary: i === 0,
            position: rebalance(translations.length)[i]!,
          })),
        ),
      );
      if (shelfItemRows.length > 0) {
        await ctx.db
          .insert(ShelfItem)
          .values(withUpdatedAtRows(shelfItemRows))
          .onConflictDoNothing();
      }

      await ctx.sync.content(unit.id);
      await ctx.sync.contentContainedUnits(unit.id);

      return unit;
    },
  );
}
