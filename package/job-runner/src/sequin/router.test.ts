import { describe, expect, test } from "bun:test";
import { parseSequinPayload } from "./parse";
import { routeSequinMessages } from "./router";

describe("Sequin payload routing", () => {
  test("routes HistoryOutbox insert to history ingest", () => {
    const messages = parseSequinPayload({
      table: "HistoryOutbox",
      action: "insert",
      record: { id: "outbox-1" },
      idempotency_key: "seq-1",
    });

    expect(routeSequinMessages(messages)).toMatchObject([
      {
        kind: "history.outbox.ingest",
        lane: "history.ingest",
        payload: { outboxId: "outbox-1" },
        source: {
          type: "sequin",
          table: "HistoryOutbox",
          action: "insert",
          sequinIdempotencyKey: "seq-1",
        },
      },
    ]);
  });

  test("routes schema-qualified HistoryOutbox inserts to history ingest", () => {
    const messages = parseSequinPayload({
      table: "public.HistoryOutbox",
      action: "insert",
      record: { id: "outbox-1" },
      idempotency_key: "seq-1",
    });

    expect(routeSequinMessages(messages)).toMatchObject([
      {
        kind: "history.outbox.ingest",
        payload: { outboxId: "outbox-1" },
        source: {
          table: "public.HistoryOutbox",
        },
      },
    ]);
  });

  test("routes quoted schema-qualified table names without losing diagnostics", () => {
    const messages = parseSequinPayload({
      table: '"public"."UnitTranslation"',
      action: "update",
      record: { unitId: "work-1" },
    });

    expect(routeSequinMessages(messages)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "search.content.patchTranslations",
          source: expect.objectContaining({
            table: '"public"."UnitTranslation"',
          }),
        }),
      ]),
    );
  });

  test("routes UnitTag without using CDC changes as a Meili patch", () => {
    const messages = parseSequinPayload({
      table: "UnitTag",
      action: "update",
      record: { unitId: "unit-1" },
      changes: { tagIds: ["stale"] },
    });

    const commands = routeSequinMessages(messages);

    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      kind: "search.content.patchTags",
      payload: { unitId: "unit-1" },
    });
    expect(JSON.stringify(commands[0])).not.toContain("stale");
  });

  test("routes main database rank-relevant rows to ranking invalidations", () => {
    const messages = parseSequinPayload({
      table: "Post",
      action: "update",
      record: { unitId: "post-1", replyCount: 3 },
    });

    expect(routeSequinMessages(messages)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ranking.invalidate",
          lane: "ranking",
          payload: {
            unitId: "post-1",
            rankKind: "post",
            reason: "Post CDC",
          },
        }),
      ]),
    );
  });

  test("routes ReactionSummary changes to ranking invalidations", () => {
    const messages = parseSequinPayload({
      table: "ReactionSummary",
      action: "delete",
      record: { targetId: "unit-1", reaction: "upvote", count: 1 },
    });

    expect(routeSequinMessages(messages)).toMatchObject([
      {
        kind: "ranking.reactionBucket",
        lane: "ranking",
        payload: {
          targetId: "unit-1",
          scopeKey: "global",
          reaction: "upvote",
          count: -1,
        },
      },
      {
        kind: "ranking.invalidate",
        lane: "ranking",
        payload: { unitId: "unit-1", reason: "ReactionSummary CDC" },
      },
    ]);
  });

  test("routes ReactionSummary update deltas into ranking vote buckets", () => {
    const messages = parseSequinPayload({
      table: "ReactionSummary",
      action: "update",
      record: {
        targetId: "unit-1",
        scopeKey: "realm:realm-1",
        reaction: "downvote",
        count: 3,
      },
      changes: { count: 1 },
      commit_timestamp: "2026-02-01T10:25:00.000Z",
    });

    expect(routeSequinMessages(messages)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ranking.reactionBucket",
          payload: {
            targetId: "unit-1",
            scopeKey: "realm:realm-1",
            reaction: "downvote",
            count: 2,
            at: "2026-02-01T10:25:00.000Z",
          },
        }),
        expect.objectContaining({
          kind: "ranking.invalidate",
          payload: {
            unitId: "unit-1",
            scope: { kind: "realm", id: "realm-1" },
            reason: "ReactionSummary realm CDC",
          },
        }),
      ]),
    );
  });

  test("routes unit metadata changes to direct target fanouts", () => {
    const messages = parseSequinPayload({
      table: "UnitTranslation",
      action: "update",
      record: { unitId: "work-1" },
    });

    expect(routeSequinMessages(messages)).toMatchObject([
      { kind: "search.content.patchTranslations" },
      { kind: "search.post.patchTargetFanout" },
      {
        kind: "search.shelfItem.sourceFanout",
        payload: { itemType: "unit", itemId: "work-1" },
      },
    ]);
  });

  test("routes ShelfItem changes to shelf item sync and shelf contained-unit patch", () => {
    const messages = parseSequinPayload({
      table: "ShelfItem",
      action: "insert",
      record: { shelfId: "shelf-1", itemType: "unit", itemId: "unit-1" },
    });

    expect(routeSequinMessages(messages)).toMatchObject([
      {
        kind: "search.shelfItem.sync",
        payload: { shelfId: "shelf-1", itemType: "unit", itemId: "unit-1" },
      },
      {
        kind: "search.content.patchContainedUnitIds",
        payload: { unitId: "shelf-1" },
      },
    ]);
  });

  test("routes content-structure node changes to Series repair and search sync", () => {
    const messages = parseSequinPayload({
      table: "ContentStructureNode",
      action: "update",
      record: { ownerUnitId: "series-1", contentUnitId: "release-1" },
    });

    expect(routeSequinMessages(messages)).toMatchObject([
      {
        kind: "maintenance.series.contentIndexRepair",
        payload: { seriesUnitId: "series-1" },
      },
      {
        kind: "search.content.sync",
        payload: { unitId: "series-1" },
      },
    ]);
  });

  test("routes lightweight Comment changes by comment id", () => {
    const messages = parseSequinPayload({
      table: "Comment",
      action: "update",
      record: { id: "comment-1", rootUnitId: "post-1" },
    });

    expect(routeSequinMessages(messages)).toMatchObject([
      {
        kind: "search.comment.sync",
        payload: { commentId: "comment-1" },
      },
      {
        kind: "search.shelfItem.sourceFanout",
        payload: { itemType: "comment", itemId: "comment-1" },
      },
    ]);
  });

  test("ignores unknown tables", () => {
    const messages = parseSequinPayload({
      table: "Unknown",
      action: "insert",
      record: { id: "1" },
    });

    expect(routeSequinMessages(messages)).toEqual([]);
  });
});
