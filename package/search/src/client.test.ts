import { describe, expect, mock, test } from "bun:test";
import { SearchClient } from "./client";

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
});
