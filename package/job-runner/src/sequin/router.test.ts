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
      record: { targetId: "unit-1", reaction: "upvote" },
    });

    expect(routeSequinMessages(messages)).toMatchObject([
      {
        kind: "ranking.invalidate",
        lane: "ranking",
        payload: { unitId: "unit-1", reason: "ReactionSummary CDC" },
      },
    ]);
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
