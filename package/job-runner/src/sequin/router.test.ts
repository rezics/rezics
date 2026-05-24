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

  test("ignores unknown tables", () => {
    const messages = parseSequinPayload({
      table: "Unknown",
      action: "insert",
      record: { id: "1" },
    });

    expect(routeSequinMessages(messages)).toEqual([]);
  });
});
