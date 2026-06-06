import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  lastReadAnchorSchema,
  nodeCompletionToggleBodySchema,
  progressExtraSchema,
  progressLibraryListResponseSchema,
  SYSTEM_SHELF_KIND_KEYS,
  unitProgressListResponseSchema,
  unitProgressRowDTOSchema,
  unitProgressUpsertBodySchema,
  userUnitProgressStatusValues,
} from "./progress";

describe("progress contract schemas", () => {
  test("exposes status values and system shelf kind keys", () => {
    expect(userUnitProgressStatusValues).toEqual([
      "BACKLOG",
      "ACTIVE",
      "PAUSED",
      "COMPLETED",
      "DROPPED",
    ]);
    expect(SYSTEM_SHELF_KIND_KEYS).toEqual([
      "favorites",
      "saved",
      "backlog",
      "active",
      "completed",
    ]);
  });

  test("validates upsert input bounds", () => {
    expect(
      Value.Check(unitProgressUpsertBodySchema, {
        progress: 0.5,
        status: "ACTIVE",
        completedCount: 2,
        lastReadNodeId: "node-1",
        lastReadAnchor: { text: "Chapter opening" },
        addTimeMs: 1000,
        extra: { paused: { reasonPostUnitIds: ["post-1"] } },
      }),
    ).toBe(true);
    expect(Value.Check(unitProgressUpsertBodySchema, { progress: 1.1 })).toBe(
      false,
    );
    expect(Value.Check(unitProgressUpsertBodySchema, { addTimeMs: -1 })).toBe(
      false,
    );
    expect(
      Value.Check(unitProgressUpsertBodySchema, { completedCount: -1 }),
    ).toBe(false);
    expect(
      Value.Check(unitProgressUpsertBodySchema, {
        lastReadAnchor: { text: "" },
      }),
    ).toBe(false);
  });

  test("lastReadAnchor enforces text bounds and rejects unknown keys", () => {
    expect(Value.Check(lastReadAnchorSchema, { text: "hello" })).toBe(true);
    expect(Value.Check(lastReadAnchorSchema, { text: "" })).toBe(false);
    expect(Value.Check(lastReadAnchorSchema, { text: "x".repeat(201) })).toBe(
      false,
    );
    expect(Value.Check(lastReadAnchorSchema, { text: "ok", extra: 1 })).toBe(
      false,
    );
    expect(Value.Check(lastReadAnchorSchema, {})).toBe(false);
  });

  test("nodeCompletionToggleBody requires nodeId and isCompleted", () => {
    expect(
      Value.Check(nodeCompletionToggleBodySchema, {
        nodeId: "node-1",
        isCompleted: true,
      }),
    ).toBe(true);
    expect(
      Value.Check(nodeCompletionToggleBodySchema, {
        nodeId: "node-1",
        isCompleted: false,
      }),
    ).toBe(true);
    expect(Value.Check(nodeCompletionToggleBodySchema, { nodeId: "n-1" })).toBe(
      false,
    );
    expect(
      Value.Check(nodeCompletionToggleBodySchema, { isCompleted: true }),
    ).toBe(false);
  });

  test("validates progress row and list response round trip shape", () => {
    const row = {
      userId: "user-1",
      unitId: "unit-1",
      progress: 1,
      status: "COMPLETED",
      isDeleted: false,
      completedCount: 1,
      totalTimeMs: 123,
      lastReadNodeId: null,
      lastReadAnchor: null,
      firstSeenAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-02T00:00:00.000Z",
      extra: null,
    };

    expect(Value.Check(unitProgressRowDTOSchema, row)).toBe(true);
    expect(
      Value.Check(unitProgressListResponseSchema, {
        rows: [row],
        nextCursor: null,
      }),
    ).toBe(true);

    expect(
      Value.Check(unitProgressRowDTOSchema, {
        ...row,
        lastReadNodeId: "node-1",
        lastReadAnchor: { text: "Resume here" },
      }),
    ).toBe(true);
  });

  test("validates hydrated progress library rows", () => {
    const row = {
      userId: "user-1",
      unitId: "book-1",
      progress: 0.5,
      status: "ACTIVE",
      isDeleted: false,
      completedCount: 0,
      totalTimeMs: 123,
      lastReadNodeId: "node-1",
      lastReadAnchor: { text: "Resume here" },
      firstSeenAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-02T00:00:00.000Z",
      extra: null,
    };

    expect(
      Value.Check(progressLibraryListResponseSchema, {
        rows: [
          {
            progress: row,
            progressUnit: {
              unitId: "book-1",
              title: "Dune",
              coverUrl: "https://cdn.example/dune.jpg",
              unitType: "BOOK",
              catalogEntryKind: "MAIN",
              targetUnitId: null,
            },
            mainUnitContext: null,
            resumeRoute: { kind: "node", bookId: "book-1", nodeId: "node-1" },
            shelves: [{ shelfId: "shelf-1", title: "Reading" }],
          },
        ],
        nextCursor: null,
      }),
    ).toBe(true);
  });

  test("validates variant-owned progress rows with separate main context", () => {
    const row = {
      userId: "user-1",
      unitId: "variant-1",
      progress: 0.2,
      status: "ACTIVE",
      isDeleted: false,
      completedCount: 0,
      totalTimeMs: 123,
      lastReadNodeId: null,
      lastReadAnchor: null,
      firstSeenAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-02T00:00:00.000Z",
      extra: null,
    };

    expect(
      Value.Check(progressLibraryListResponseSchema, {
        rows: [
          {
            progress: row,
            progressUnit: {
              unitId: "variant-1",
              title: "Dune First Edition",
              coverUrl: "https://cdn.example/dune-first.jpg",
              unitType: "BOOK",
              catalogEntryKind: "VARIANT",
              targetUnitId: "book-1",
            },
            mainUnitContext: {
              unitId: "book-1",
              title: "Dune",
              unitType: "BOOK",
              catalogEntryKind: "MAIN",
              targetUnitId: null,
            },
            resumeRoute: { kind: "book", bookId: "variant-1" },
            shelves: [],
          },
        ],
        nextCursor: null,
      }),
    ).toBe(true);
  });

  test("progressExtraSchema accepts narrow shapes and rejects unknown keys", () => {
    expect(Value.Check(progressExtraSchema, {})).toBe(true);
    expect(
      Value.Check(progressExtraSchema, {
        paused: { reasonPostUnitIds: ["p-1", "p-2"] },
      }),
    ).toBe(true);
    expect(
      Value.Check(progressExtraSchema, {
        dropped: { reasonPostUnitIds: [] },
      }),
    ).toBe(true);
    expect(
      Value.Check(progressExtraSchema, {
        paused: { reasonPostUnitIds: ["p-1"] },
        dropped: { reasonPostUnitIds: ["p-2"] },
      }),
    ).toBe(true);

    // Unknown top-level keys rejected
    expect(
      Value.Check(progressExtraSchema, {
        device: "web",
      }),
    ).toBe(false);
    expect(
      Value.Check(progressExtraSchema, {
        paused: { reasonPostUnitIds: ["p-1"] },
        unknownBucket: { foo: 1 },
      }),
    ).toBe(false);
    // Unknown sub-keys rejected
    expect(
      Value.Check(progressExtraSchema, {
        paused: { reasonPostUnitIds: ["p-1"], extra: 1 },
      }),
    ).toBe(false);
    // Wrong types rejected
    expect(
      Value.Check(progressExtraSchema, {
        paused: { reasonPostUnitIds: [123] },
      }),
    ).toBe(false);
  });

  test("upsert body accepts null extra and empty extra", () => {
    expect(Value.Check(unitProgressUpsertBodySchema, { extra: null })).toBe(
      true,
    );
    expect(Value.Check(unitProgressUpsertBodySchema, { extra: {} })).toBe(true);
    expect(
      Value.Check(unitProgressUpsertBodySchema, {
        extra: { paused: { reasonPostUnitIds: [] } },
      }),
    ).toBe(true);
    expect(
      Value.Check(unitProgressUpsertBodySchema, {
        extra: { device: "web" },
      }),
    ).toBe(false);
  });
});
