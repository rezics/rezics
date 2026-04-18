import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import type { Prisma, PrismaClient } from "#/prisma/generated/client.js";
import type { CreatedUnit, CreatedUser } from "./types.js";
import { chunkedParallel, pickN, randomInt } from "./utils.js";

const CHUNK_SIZE = 10;

const STORY_REALM_FIELDS = [
  { key: "pacing", label: "Pacing", sortOrder: 1 },
  { key: "plot", label: "Plot", sortOrder: 2 },
  { key: "characters", label: "Characters", sortOrder: 3 },
  { key: "world-building", label: "World Building", sortOrder: 4 },
  { key: "writing-style", label: "Writing Style", sortOrder: 5 },
];

interface ScoreResult {
  scoreEntries: Map<string, string>; // `${userId}:${unitId}:${realm}` -> scoreEntryId
}

/**
 * Seed scores for works. Creates ScoreEntry + ScoreAggregate rows.
 * Returns a map of (userId:unitId:realm) -> scoreEntryId for linking posts.
 */
export async function seedScores(
  prisma: PrismaClient,
  works: CreatedUnit[],
  users: CreatedUser[],
  realms: CreatedUnit[],
  scoresPerWork: number,
): Promise<ScoreResult> {
  console.log(
    `[Seed] Seeding scores for ${works.length} works (~${scoresPerWork} per work)...`,
  );

  const scoreEntries = new Map<string, string>();

  // Pick a default realm (first realm or create a sentinel)
  const defaultRealm = realms[0];
  if (!defaultRealm) {
    console.log("[Seed]   No realms available, skipping scores.");
    return { scoreEntries };
  }
  const defaultRealmId = defaultRealm.id;

  // Pick a "story" realm for field-level scoring (second realm if available)
  const storyRealm = realms.length > 1 ? realms[1] : null;

  // Seed realm fields for the story realm
  if (storyRealm) {
    await prisma.scoreRealmField.createMany({
      data: STORY_REALM_FIELDS.map((f) => ({
        realm: storyRealm.id,
        ...f,
      })),
    });
    console.log(
      `[Seed]   Created ${STORY_REALM_FIELDS.length} realm fields for story realm`,
    );
  }

  // For each work, create score entries from random users
  await chunkedParallel(works, CHUNK_SIZE, async (work) => {
    const scoringUsers = pickN(
      users,
      Math.min(
        randomInt(Math.floor(scoresPerWork * 0.5), scoresPerWork),
        users.length,
      ),
    );

    const entries: {
      id: string;
      userId: string;
      unitId: string;
      realm: string;
      value: number;
      fields: Prisma.InputJsonValue | undefined;
    }[] = [];

    for (const user of scoringUsers) {
      const value = randomInt(1, 10);
      const id = randomUUID();
      entries.push({
        id,
        userId: user.unitId,
        unitId: work.id,
        realm: defaultRealmId,
        value,
        fields: undefined,
      });
      scoreEntries.set(`${user.unitId}:${work.id}:${defaultRealmId}`, id);

      // Some users also score in the story realm with fields
      if (storyRealm && faker.datatype.boolean({ probability: 0.3 })) {
        const storyId = randomUUID();
        const storyValue = randomInt(1, 10);
        const fieldKeys = pickN(
          STORY_REALM_FIELDS,
          randomInt(2, STORY_REALM_FIELDS.length),
        );
        const fields: Record<string, number> = {};
        for (const f of fieldKeys) {
          fields[f.key] = randomInt(1, 10);
        }
        entries.push({
          id: storyId,
          userId: user.unitId,
          unitId: work.id,
          realm: storyRealm.id,
          value: storyValue,
          fields: fields as Prisma.InputJsonValue,
        });
        scoreEntries.set(`${user.unitId}:${work.id}:${storyRealm.id}`, storyId);
      }
    }

    // Batch create entries
    if (entries.length > 0) {
      await prisma.scoreEntry.createMany({
        data: entries.map((e) => ({
          id: e.id,
          userId: e.userId,
          unitId: e.unitId,
          realm: e.realm,
          value: e.value,
          fields: e.fields,
        })),
      });
    }

    // Build aggregates per realm for this work
    const byRealm = new Map<
      string,
      {
        totalScore: number;
        totalCount: number;
        distribution: Record<string, number>;
        fields: Record<
          string,
          { total: number; count: number; dist: Record<string, number> }
        >;
      }
    >();

    for (const entry of entries) {
      let agg = byRealm.get(entry.realm);
      if (!agg) {
        agg = { totalScore: 0, totalCount: 0, distribution: {}, fields: {} };
        byRealm.set(entry.realm, agg);
      }
      agg.totalScore += entry.value;
      agg.totalCount += 1;
      const distKey = String(entry.value);
      agg.distribution[distKey] = (agg.distribution[distKey] ?? 0) + 1;

      if (entry.fields && typeof entry.fields === "object") {
        const entryFields = entry.fields as Record<string, number>;
        for (const [key, val] of Object.entries(entryFields)) {
          if (!agg.fields[key]) {
            agg.fields[key] = { total: 0, count: 0, dist: {} };
          }
          agg.fields[key].total += val;
          agg.fields[key].count += 1;
          const fDistKey = String(val);
          agg.fields[key].dist[fDistKey] =
            (agg.fields[key].dist[fDistKey] ?? 0) + 1;
        }
      }
    }

    // Write aggregates
    const aggregateData = Array.from(byRealm.entries()).map(([realm, agg]) => ({
      unitId: work.id,
      realm,
      totalScore: agg.totalScore,
      totalCount: agg.totalCount,
      distribution: agg.distribution as Prisma.InputJsonValue,
      fields:
        Object.keys(agg.fields).length > 0
          ? (agg.fields as Prisma.InputJsonValue)
          : undefined,
    }));

    if (aggregateData.length > 0) {
      await prisma.scoreAggregate.createMany({ data: aggregateData });
    }
  });

  return { scoreEntries };
}
