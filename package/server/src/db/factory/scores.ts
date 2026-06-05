import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import { ScoreAggregate, ScoreEntry, ScoreRealmField } from "../schema";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type { CreatedUnit, CreatedUser } from "./types.js";
import {
  chunkedParallel,
  pickN,
  randomInt,
  withUpdatedAtRows,
} from "./utils.js";

const CHUNK_SIZE = 10;

const STORY_REALM_FIELDS = [
  { key: "pacing", label: "Pacing", sortOrder: 1 },
  { key: "plot", label: "Plot", sortOrder: 2 },
  { key: "characters", label: "Characters", sortOrder: 3 },
  { key: "world-building", label: "World Building", sortOrder: 4 },
  { key: "writing-style", label: "Writing Style", sortOrder: 5 },
];

interface ScoreResult {
  scoreEntries: Map<string, string>;
}

export async function seedScores(
  ctx: SeedCtx,
  scoresSpec: CountSpec,
  works: CreatedUnit[],
  users: CreatedUser[],
  realms: CreatedUnit[],
): Promise<ScoreResult> {
  console.log(`[Seed] Seeding scores for ${works.length} works...`);

  const scoreEntries = new Map<string, string>();

  const defaultRealm = realms[0];
  if (!defaultRealm) {
    console.log("[Seed]   No realms available, skipping scores.");
    return { scoreEntries };
  }
  const defaultRealmId = defaultRealm.id;
  const storyRealm = realms.length > 1 ? realms[1] : null;

  if (storyRealm) {
    await ctx.db.insert(ScoreRealmField).values(
      withUpdatedAtRows(
        STORY_REALM_FIELDS.map((f) => ({
          realm: storyRealm.id,
          ...f,
        })),
      ),
    );
    console.log(
      `[Seed]   Created ${STORY_REALM_FIELDS.length} realm fields for story realm`,
    );
  }

  await chunkedParallel(works, CHUNK_SIZE, async (work) => {
    const targetCount = ctx.draw(scoresSpec);
    const scoringUsers = pickN(users, Math.min(targetCount, users.length));

    const entries: {
      id: string;
      userId: string;
      unitId: string;
      realm: string;
      value: number;
      fields: unknown | undefined;
    }[] = [];

    for (const user of scoringUsers) {
      const value = randomInt(1, 10);
      const id = randomUUID();
      entries.push({
        id,
        userId: user.userId,
        unitId: work.id,
        realm: defaultRealmId,
        value,
        fields: undefined,
      });
      scoreEntries.set(`${user.userId}:${work.id}:${defaultRealmId}`, id);

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
          userId: user.userId,
          unitId: work.id,
          realm: storyRealm.id,
          value: storyValue,
          fields: fields as unknown,
        });
        scoreEntries.set(`${user.userId}:${work.id}:${storyRealm.id}`, storyId);
      }
    }

    if (entries.length > 0) {
      await ctx.db.insert(ScoreEntry).values(
        withUpdatedAtRows(
          entries.map((e) => ({
            id: e.id,
            userId: e.userId,
            unitId: e.unitId,
            realm: e.realm,
            value: e.value,
            fields: e.fields,
          })),
        ),
      );
    }

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

    const aggregateData = Array.from(byRealm.entries()).map(([realm, agg]) => ({
      unitId: work.id,
      realm,
      totalScore: agg.totalScore,
      totalCount: agg.totalCount,
      distribution: agg.distribution as unknown,
      fields:
        Object.keys(agg.fields).length > 0
          ? (agg.fields as unknown)
          : undefined,
    }));

    if (aggregateData.length > 0) {
      await ctx.db
        .insert(ScoreAggregate)
        .values(withUpdatedAtRows(aggregateData));
    }
  });

  return { scoreEntries };
}
