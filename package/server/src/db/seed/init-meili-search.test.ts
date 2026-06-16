import { describe, expect, mock, test } from "bun:test";
import { initMeiliSearch } from "./init-meili-search";

describe("initMeiliSearch", () => {
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
      initEntityIndex: mock(async () => undefined),
      initProgressIndex: mock(async () => undefined),
      initCommentIndex: mock(async () => undefined),
      initPollIndex: mock(async () => undefined),
      initShelfItemIndex: mock(async () => undefined),
    };
  }

  test("clears known index documents before initializing when clean is requested", async () => {
    const calls: string[] = [];
    const searchClient = makeSearchClient();
    searchClient.resetKnownIndexes.mockImplementation(async () => {
      calls.push("clean");
    });
    searchClient.initContentIndex.mockImplementation(async () => {
      calls.push("init-content");
    });

    await initMeiliSearch(searchClient as never, { clean: true });

    expect(searchClient.resetKnownIndexes).toHaveBeenCalledTimes(1);
    expect(calls[0]).toBe("clean");
    expect(calls).toContain("init-content");
  });

  test("keeps existing documents when clean is not requested", async () => {
    const searchClient = makeSearchClient();

    await initMeiliSearch(searchClient as never);

    expect(searchClient.resetKnownIndexes).not.toHaveBeenCalled();
    expect(searchClient.initContentIndex).toHaveBeenCalledTimes(1);
  });
});
