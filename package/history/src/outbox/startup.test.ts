import { describe, expect, test } from "bun:test";
import { shouldStartHistoryOutboxPoller } from "./startup";

describe("history outbox poller startup", () => {
  test("default startup does not poll when queue ingestion is enabled", () => {
    expect(shouldStartHistoryOutboxPoller({})).toBe(false);
    expect(
      shouldStartHistoryOutboxPoller({
        HISTORY_QUEUE_INGESTION_ENABLED: "true",
      }),
    ).toBe(false);
  });

  test("temporary fallback poller requires explicit opt-in", () => {
    expect(
      shouldStartHistoryOutboxPoller({
        HISTORY_QUEUE_INGESTION_ENABLED: "true",
        HISTORY_OUTBOX_POLLER_FALLBACK: "1",
      }),
    ).toBe(true);
  });

  test("disabling queue ingestion alone does not start a second owner", () => {
    expect(
      shouldStartHistoryOutboxPoller({
        HISTORY_QUEUE_INGESTION_ENABLED: "false",
      }),
    ).toBe(false);
  });
});
