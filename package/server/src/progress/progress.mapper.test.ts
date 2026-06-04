import { describe, expect, test } from "bun:test";
import { mapProgressToDTO, type ProgressStorageRow } from "./progress.mapper";

const baseRow = {
  userId: "user-1",
  unitId: "unit-1",
  progress: 0,
  status: "BACKLOG",
  isDeleted: false,
  completedCount: 0,
  totalTimeMs: 0n,
  lastReadNodeId: null,
  lastReadAnchor: null,
  firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
  lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
  extra: null,
} satisfies ProgressStorageRow;

describe("mapProgressToDTO", () => {
  test("returns null extra when stored extra is null", () => {
    expect(mapProgressToDTO({ ...baseRow }).extra).toBeNull();
  });

  test("strips unknown top-level keys from stored extra", () => {
    const row: ProgressStorageRow = {
      ...baseRow,
      extra: {
        unknownBucket: 1,
        device: "web",
        paused: { reasonPostUnitIds: ["post-1", "post-2"] },
      },
    };

    const dto = mapProgressToDTO(row);

    expect(dto.extra).toEqual({
      paused: { reasonPostUnitIds: ["post-1", "post-2"] },
    });
  });

  test("returns empty object when stored extra is unrecognized", () => {
    const row: ProgressStorageRow = {
      ...baseRow,
      extra: {
        totallyUnknown: { foo: 1 },
      },
    };

    expect(mapProgressToDTO(row).extra).toEqual({});
  });

  test("preserves dropped reason posts", () => {
    const row: ProgressStorageRow = {
      ...baseRow,
      extra: {
        dropped: { reasonPostUnitIds: ["post-x"] },
      },
    };

    expect(mapProgressToDTO(row).extra).toEqual({
      dropped: { reasonPostUnitIds: ["post-x"] },
    });
  });

  test("propagates lastReadNodeId and sanitized lastReadAnchor", () => {
    const dto = mapProgressToDTO({
      ...baseRow,
      lastReadNodeId: "node-1",
      lastReadAnchor: {
        text: "Resume",
      },
    });
    expect(dto.lastReadNodeId).toBe("node-1");
    expect(dto.lastReadAnchor).toEqual({ text: "Resume" });
  });

  test("rejects malformed lastReadAnchor (empty / too long / no text)", () => {
    const empty = mapProgressToDTO({
      ...baseRow,
      lastReadAnchor: {
        text: "",
      },
    });
    expect(empty.lastReadAnchor).toBeNull();
    const tooLong = mapProgressToDTO({
      ...baseRow,
      lastReadAnchor: {
        text: "x".repeat(201),
      },
    });
    expect(tooLong.lastReadAnchor).toBeNull();
    const wrongShape = mapProgressToDTO({
      ...baseRow,
      lastReadAnchor: {
        foo: "bar",
      },
    });
    expect(wrongShape.lastReadAnchor).toBeNull();
  });
});
