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

    expect(commands).toHaveLength(2);
    expect(commands[0]).toMatchObject({
      kind: "search.content.patchTags",
      payload: { unitId: "unit-1" },
    });
    expect(commands[1]).toMatchObject({
      kind: "search.content.syncWorkReleases",
      payload: { targetId: "unit-1" },
    });
    expect(JSON.stringify(commands[0])).not.toContain("stale");
  });

  test("routes UnitWork changes to member and work-domain projection rebuilds", () => {
    const messages = parseSequinPayload({
      table: "UnitWork",
      action: "insert",
      record: { unitId: "release-1", workUnitId: "work-1", role: "RELEASE" },
    });

    expect(routeSequinMessages(messages)).toMatchObject([
      {
        kind: "search.content.sync",
        payload: { unitId: "release-1" },
      },
      {
        kind: "search.post.sync",
        payload: { postId: "release-1" },
      },
      {
        kind: "search.content.syncWorkReleases",
        payload: { targetId: "work-1" },
      },
    ]);
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
      record: { targetId: "unit-1", reaction: "like" },
    });

    expect(routeSequinMessages(messages)).toMatchObject([
      {
        kind: "ranking.invalidate",
        lane: "ranking",
        payload: { unitId: "unit-1", reason: "ReactionSummary CDC" },
      },
    ]);
  });

  test("routes work metadata changes to release projection rebuilds", () => {
    const messages = parseSequinPayload({
      table: "UnitTranslation",
      action: "update",
      record: { unitId: "work-1" },
    });

    expect(routeSequinMessages(messages)).toMatchObject([
      { kind: "search.content.patchTranslations" },
      { kind: "search.post.patchTargetFanout" },
      {
        kind: "search.content.syncWorkReleases",
        payload: { targetId: "work-1" },
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
