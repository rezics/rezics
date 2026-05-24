import { describe, expect, test } from "bun:test";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { createSearchHandlers } from "./handlers";

describe("search handlers", () => {
  test("dispatches content delete to the search client delete path", async () => {
    const deleted: string[][] = [];
    const handlers = createSearchHandlers({
      deleteContent: async (ids: string[]) => {
        deleted.push(ids);
      },
    } as never);
    const command = createSearchCommand(SEARCH_COMMAND_KINDS.contentDelete, {
      unitId: "unit-1",
    });

    await handlers[command.kind]?.(command, {
      enqueue: async () => undefined,
    });

    expect(deleted).toEqual([["unit-1"]]);
  });
});
