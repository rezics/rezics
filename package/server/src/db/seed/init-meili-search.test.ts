import { describe, expect, mock, test } from "bun:test";
import { ensureMeiliIndexes, resetMeiliIndexes } from "./init-meili-search";

describe("Meili seed index helpers", () => {
  function makeSearchClient() {
    return {
      checkHealth: mock(async () => true),
      resetKnownIndexes: mock(async () => undefined),
      initContentIndex: mock(async () => undefined),
      initFeedbackIndex: mock(async () => undefined),
      initUserIndex: mock(async () => undefined),
      initPostIndex: mock(async () => undefined),
      initRealmIndex: mock(async () => undefined),
      initZoneIndex: mock(async () => undefined),
      initTagIndex: mock(async () => undefined),
      initLabelIndex: mock(async () => undefined),
      initEntityIndex: mock(async () => undefined),
      initProgressIndex: mock(async () => undefined),
      initCommentIndex: mock(async () => undefined),
      initPollIndex: mock(async () => undefined),
      initShelfItemIndex: mock(async () => undefined),
    };
  }

  test("reset deletes known indexes before ensuring schema", async () => {
    const calls: string[] = [];
    const searchClient = makeSearchClient();
    searchClient.resetKnownIndexes.mockImplementation(async () => {
      calls.push("clean");
    });
    searchClient.initContentIndex.mockImplementation(async () => {
      calls.push("init-content");
    });

    await resetMeiliIndexes(searchClient as never);

    expect(searchClient.resetKnownIndexes).toHaveBeenCalledTimes(1);
    expect(calls[0]).toBe("clean");
    expect(calls).toContain("init-content");
  });

  test("ensure keeps existing documents", async () => {
    const searchClient = makeSearchClient();

    await ensureMeiliIndexes(searchClient as never);

    expect(searchClient.resetKnownIndexes).not.toHaveBeenCalled();
    expect(searchClient.initContentIndex).toHaveBeenCalledTimes(1);
    expect(searchClient.initTagIndex).toHaveBeenCalledTimes(1);
    expect(searchClient.initLabelIndex).toHaveBeenCalledTimes(1);
  });
});
