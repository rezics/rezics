import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { Pool } from "pg";

function readEnv(path: string, key: string) {
  const value = parse(readFileSync(path))[key];
  if (!value) throw new Error(`Missing ${key} in ${path}`);
  return value;
}

const serverPool = new Pool({
  connectionString: readEnv("packages/server/.env", "DATABASE_URL"),
});
const authPool = new Pool({
  connectionString: readEnv("packages/auth/.env", "DATABASE_URL"),
});
const notifyPool = new Pool({
  connectionString: readEnv("packages/notify/.env", "NOTIFY_DATABASE_URL"),
});
const historyPool = new Pool({
  connectionString: readEnv("packages/history/.env", "HISTORY_DATABASE_URL"),
});
const rankingPool = new Pool({
  connectionString: readEnv("packages/ranking/.env", "RANKING_DATABASE_URL"),
});

function uuid() {
  return crypto.randomUUID();
}

function expectDate(value: unknown) {
  expect(value).toBeInstanceOf(Date);
}

describe("updatedAt database defaults", () => {
  afterAll(async () => {
    await Promise.all([
      serverPool.end(),
      authPool.end(),
      notifyPool.end(),
      historyPool.end(),
      rankingPool.end(),
    ]);
  });

  test("representative owner inserts can omit updatedAt", async () => {
    const serverKey = `timestamp-default:${uuid()}`;
    const authEmail = `${uuid()}@timestamp-default.test`;
    const conversationId = uuid();
    const participantA = uuid();
    const participantB = uuid();
    const cursorSource = `timestamp-default:${uuid()}`;
    const rankingTargetId = uuid();

    try {
      const serverResult = await serverPool.query(
        `insert into "EchoKV" ("key", "value")
         values ($1, '{"ok":true}'::jsonb)
         returning "updatedAt"`,
        [serverKey],
      );
      expectDate(serverResult.rows[0]?.updatedAt);

      const authResult = await authPool.query(
        `insert into "User" ("name", "email")
         values ('Timestamp Defaults', $1)
         returning "updatedAt"`,
        [authEmail],
      );
      expectDate(authResult.rows[0]?.updatedAt);

      const notifyResult = await notifyPool.query(
        `insert into "Conversation" ("id", "participantA", "participantB")
         values ($1, $2, $3)
         returning "updatedAt"`,
        [conversationId, participantA, participantB],
      );
      expectDate(notifyResult.rows[0]?.updatedAt);

      const historyResult = await historyPool.query(
        `insert into "IngestionCursor" ("source")
         values ($1)
         returning "updatedAt"`,
        [cursorSource],
      );
      expectDate(historyResult.rows[0]?.updatedAt);

      const rankingResult = await rankingPool.query(
        `insert into "RankingReactionBucket" (
          "targetId",
          "reaction",
          "bucketStart",
          "bucketEnd"
        )
        values (
          $1,
          'upvote',
          '2026-01-01T00:00:00.000Z',
          '2026-01-01T01:00:00.000Z'
        )
        returning "updatedAt"`,
        [rankingTargetId],
      );
      expectDate(rankingResult.rows[0]?.updatedAt);
    } finally {
      await Promise.all([
        serverPool.query(`delete from "EchoKV" where "key" = $1`, [serverKey]),
        authPool.query(`delete from "User" where "email" = $1`, [authEmail]),
        notifyPool.query(`delete from "Conversation" where "id" = $1`, [
          conversationId,
        ]),
        historyPool.query(`delete from "IngestionCursor" where "source" = $1`, [
          cursorSource,
        ]),
        rankingPool.query(
          `delete from "RankingReactionBucket" where "targetId" = $1`,
          [rankingTargetId],
        ),
      ]);
    }
  });

  test("explicit updatedAt values still win over defaults", async () => {
    const key = `timestamp-default-explicit:${uuid()}`;
    const explicit = new Date("2026-01-01T00:00:00.000Z");

    try {
      const result = await serverPool.query(
        `insert into "EchoKV" ("key", "value", "updatedAt")
         values ($1, '{"ok":true}'::jsonb, $2)
         returning "updatedAt"`,
        [key, explicit],
      );

      expect(result.rows[0]?.updatedAt).toEqual(explicit);
    } finally {
      await serverPool.query(`delete from "EchoKV" where "key" = $1`, [key]);
    }
  });
});
