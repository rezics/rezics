import { describe, expect, mock, test } from "bun:test";
import { SearchClient } from "./client";
import { PROGRESS_INDEX_NAME } from "./progress";
import {
  EXPECTED_MEILI_INDEX_SCHEMAS,
  type ExpectedMeiliIndexUid,
  getExpectedMeiliIndexSettings,
} from "./schema";
import { SHELF_ITEM_INDEX_NAME } from "./shelf-item";

describe("SearchClient", () => {
  test("waits longer than the MeiliSearch client default for init tasks", async () => {
    const searchClient = new SearchClient({
      host: "http://localhost:7700",
      apiKey: "masterKey",
    });
    const updateSettings = mock(async () => ({ taskUid: 101 }));
    const addDocuments = mock(async () => ({ taskUid: 102 }));
    const waitForTask = mock(async () => ({ status: "succeeded" }));

    Object.defineProperty(searchClient, "progressIndex", {
      value: { updateSettings, addDocuments },
    });
    Object.defineProperty(searchClient.meili.tasks, "waitForTask", {
      value: waitForTask,
    });

    await searchClient.initProgressIndex();

    expect(waitForTask).toHaveBeenCalledWith(101, {
      timeout: 60_000,
      interval: 100,
    });
    expect(waitForTask).toHaveBeenCalledWith(102, {
      timeout: 60_000,
      interval: 100,
    });
  });

  test("indexes aliasValues below primary translation fields", async () => {
    const searchClient = new SearchClient({
      host: "http://localhost:7700",
      apiKey: "masterKey",
    });
    const updateSettings = mock(async () => ({ taskUid: 201 }));
    const addDocuments = mock(async () => ({ taskUid: 202 }));
    const waitForTask = mock(async () => ({ status: "succeeded" }));

    Object.defineProperty(searchClient, "contentIndex", {
      value: { updateSettings, addDocuments },
    });
    Object.defineProperty(searchClient.meili.tasks, "waitForTask", {
      value: waitForTask,
    });

    await searchClient.initContentIndex();

    const settings = (updateSettings.mock.calls as any)[0][0] as {
      searchableAttributes: string[];
    };
    expect(
      settings.searchableAttributes.indexOf("aliasValues"),
    ).toBeGreaterThan(settings.searchableAttributes.indexOf("titles"));
    expect(settings.searchableAttributes).toContain("aliasValues");
  });

  test.each([
    ["content", "contentIndex", "initContentIndex"],
    ["feedbacks", "feedbackIndex", "initFeedbackIndex"],
    ["users", "userIndex", "initUserIndex"],
    ["posts", "postIndex", "initPostIndex"],
    ["comments", "commentIndex", "initCommentIndex"],
    ["polls", "pollIndex", "initPollIndex"],
    [SHELF_ITEM_INDEX_NAME, "shelfItemIndex", "initShelfItemIndex"],
    ["realms", "realmIndex", "initRealmIndex"],
    ["entities", "entityIndex", "initEntityIndex"],
    [PROGRESS_INDEX_NAME, "progressIndex", "initProgressIndex"],
  ] as const)("initializes %s from the expected schema registry", async (uid, indexProperty, initMethod) => {
    const searchClient = new SearchClient({
      host: "http://localhost:7700",
      apiKey: "masterKey",
    });
    const updateSettings = mock(async () => ({ taskUid: 301 }));
    const addDocuments = mock(async () => ({ taskUid: 302 }));
    const waitForTask = mock(async () => ({ status: "succeeded" }));

    Object.defineProperty(searchClient, indexProperty, {
      value: { updateSettings, addDocuments },
    });
    Object.defineProperty(searchClient.meili.tasks, "waitForTask", {
      value: waitForTask,
    });

    await searchClient[initMethod]();

    const schema = EXPECTED_MEILI_INDEX_SCHEMAS.find(
      (entry) => entry.uid === uid,
    );

    expect(schema).toBeDefined();
    expect(updateSettings).toHaveBeenCalledWith(
      getExpectedMeiliIndexSettings(schema!),
    );
    expect(addDocuments).toHaveBeenCalledWith([], {
      primaryKey: schema!.primaryKey,
    });
  });

  test("registry represents every known Meili index", () => {
    const uids = EXPECTED_MEILI_INDEX_SCHEMAS.map((schema) => schema.uid);

    expect(uids).toEqual([
      "content",
      "feedbacks",
      "users",
      "posts",
      "comments",
      "polls",
      "shelf_items",
      "realms",
      "entities",
      "user_unit_progress",
    ] satisfies ExpectedMeiliIndexUid[]);

    for (const schema of EXPECTED_MEILI_INDEX_SCHEMAS) {
      expect(schema.primaryKey).toBe("id");
      expect(schema.domain.length).toBeGreaterThan(0);
      expect(schema.description.length).toBeGreaterThan(0);
      expect(Array.isArray(schema.searchableAttributes)).toBe(true);
      expect(Array.isArray(schema.filterableAttributes)).toBe(true);
      expect(Array.isArray(schema.sortableAttributes)).toBe(true);
    }
  });
});
