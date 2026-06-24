import { describe, expect, test } from "bun:test";
import {
  addCreditAttribution,
  addSubjectAttribution,
  buildEntityAttributionBatchOps,
  createEntityAttributionEditQueue,
  isEntityAttributionQueueDirty,
  markEntityAttributionQueueError,
  markEntityAttributionQueueSaved,
  removeCreditAttribution,
  reorderCreditAttributions,
} from "./entityAttributionEditQueue";

describe("entity attribution edit queue", () => {
  test("initializes from existing credit and subject attribution DTOs", () => {
    const queue = createEntityAttributionEditQueue({
      credits: [
        {
          unitId: "book-1",
          entityId: "entity-b",
          role: "author",
          position: "b",
        },
        {
          unitId: "book-1",
          entityId: "entity-a",
          role: "author",
          position: "a",
        },
      ],
      subjects: [
        {
          unitId: "book-1",
          entityId: "character-1",
          role: "primary_character",
          position: "a",
          weight: 0.8,
        },
      ],
    });

    expect(
      queue.current.credits.author?.map((entry) => entry.entityId),
    ).toEqual(["entity-a", "entity-b"]);
    expect(queue.current.subjects.primary_character?.[0]?.weight).toBe(0.8);
    expect(isEntityAttributionQueueDirty(queue)).toBe(false);
  });

  test("coalesces local add remove and reorder operations into setCredits", () => {
    let queue = createEntityAttributionEditQueue({
      credits: [
        {
          unitId: "book-1",
          entityId: "entity-a",
          role: "author",
          position: "a",
        },
      ],
    });

    queue = addCreditAttribution(queue, "author", { entityId: "entity-b" });
    queue = addCreditAttribution(queue, "author", { entityId: "entity-c" });
    queue = removeCreditAttribution(queue, "author", "entity-a");
    queue = reorderCreditAttributions(queue, "author", [
      "entity-c",
      "entity-b",
    ]);

    expect(buildEntityAttributionBatchOps(queue)).toEqual([
      {
        op: "setCredits",
        role: "author",
        entries: [
          { entityId: "entity-c", position: "V" },
          { entityId: "entity-b", position: "W" },
        ],
      },
    ]);
  });

  test("coalesces subject edits and preserves failed save state", () => {
    let queue = createEntityAttributionEditQueue();
    queue = addSubjectAttribution(queue, "primary_character", {
      entityId: "character-1",
      weight: 0.5,
    });
    queue = markEntityAttributionQueueError(queue, new Error("Save failed"));

    expect(queue.saveStatus).toBe("error");
    expect(queue.error?.message).toBe("Save failed");
    expect(buildEntityAttributionBatchOps(queue)).toEqual([
      {
        op: "setSubjects",
        role: "primary_character",
        entries: [{ entityId: "character-1", position: "V", weight: 0.5 }],
      },
    ]);
  });

  test("marks saved queue as clean", () => {
    let queue = createEntityAttributionEditQueue();
    queue = addCreditAttribution(queue, "author", { entityId: "entity-a" });
    queue = markEntityAttributionQueueSaved(queue);

    expect(queue.saveStatus).toBe("saved");
    expect(isEntityAttributionQueueDirty(queue)).toBe(false);
  });
});
