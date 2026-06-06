import { describe, expect, it } from "bun:test";
import { planRemoveProgress, planTransition } from "./transition";

describe("planTransition", () => {
  it("returns no ops for same-status transitions", () => {
    expect(planTransition("BACKLOG", "BACKLOG")).toEqual([]);
    expect(planTransition("ACTIVE", "ACTIVE")).toEqual([]);
    expect(planTransition("PAUSED", "PAUSED")).toEqual([]);
    expect(planTransition("COMPLETED", "COMPLETED")).toEqual([]);
    expect(planTransition("DROPPED", "DROPPED")).toEqual([]);
  });

  it("adds to backlog from null (initial set)", () => {
    expect(planTransition(null, "BACKLOG")).toEqual([
      { kind: "add", shelfKey: "backlog" },
    ]);
  });

  it("adds to active from null (initial set)", () => {
    expect(planTransition(null, "ACTIVE")).toEqual([
      { kind: "add", shelfKey: "active" },
    ]);
  });

  it("adds to completed from null (add-only)", () => {
    expect(planTransition(null, "COMPLETED")).toEqual([
      { kind: "add", shelfKey: "completed" },
    ]);
  });

  it("emits no shelf ops for null → PAUSED / DROPPED", () => {
    expect(planTransition(null, "PAUSED")).toEqual([]);
    expect(planTransition(null, "DROPPED")).toEqual([]);
  });

  it("mirrors backlog ↔ active", () => {
    expect(planTransition("BACKLOG", "ACTIVE")).toEqual([
      { kind: "remove", shelfKey: "backlog" },
      { kind: "add", shelfKey: "active" },
    ]);
    expect(planTransition("ACTIVE", "BACKLOG")).toEqual([
      { kind: "remove", shelfKey: "active" },
      { kind: "add", shelfKey: "backlog" },
    ]);
  });

  it("removes mirrored shelf when leaving for paused/dropped", () => {
    expect(planTransition("BACKLOG", "PAUSED")).toEqual([
      { kind: "remove", shelfKey: "backlog" },
    ]);
    expect(planTransition("ACTIVE", "PAUSED")).toEqual([
      { kind: "remove", shelfKey: "active" },
    ]);
    expect(planTransition("BACKLOG", "DROPPED")).toEqual([
      { kind: "remove", shelfKey: "backlog" },
    ]);
    expect(planTransition("ACTIVE", "DROPPED")).toEqual([
      { kind: "remove", shelfKey: "active" },
    ]);
  });

  it("removes mirrored shelf and adds completed when transitioning", () => {
    expect(planTransition("BACKLOG", "COMPLETED")).toEqual([
      { kind: "remove", shelfKey: "backlog" },
      { kind: "add", shelfKey: "completed" },
    ]);
    expect(planTransition("ACTIVE", "COMPLETED")).toEqual([
      { kind: "remove", shelfKey: "active" },
      { kind: "add", shelfKey: "completed" },
    ]);
  });

  it("emits add-only for paused/dropped → completed (no remove for non-mirrored)", () => {
    expect(planTransition("PAUSED", "COMPLETED")).toEqual([
      { kind: "add", shelfKey: "completed" },
    ]);
    expect(planTransition("DROPPED", "COMPLETED")).toEqual([
      { kind: "add", shelfKey: "completed" },
    ]);
  });

  it("emits add-only when entering mirrored states from non-mirrored", () => {
    expect(planTransition("PAUSED", "BACKLOG")).toEqual([
      { kind: "add", shelfKey: "backlog" },
    ]);
    expect(planTransition("PAUSED", "ACTIVE")).toEqual([
      { kind: "add", shelfKey: "active" },
    ]);
    expect(planTransition("DROPPED", "BACKLOG")).toEqual([
      { kind: "add", shelfKey: "backlog" },
    ]);
    expect(planTransition("DROPPED", "ACTIVE")).toEqual([
      { kind: "add", shelfKey: "active" },
    ]);
    expect(planTransition("COMPLETED", "BACKLOG")).toEqual([
      { kind: "add", shelfKey: "backlog" },
    ]);
    expect(planTransition("COMPLETED", "ACTIVE")).toEqual([
      { kind: "add", shelfKey: "active" },
    ]);
  });

  it("emits no ops between paused and dropped", () => {
    expect(planTransition("PAUSED", "DROPPED")).toEqual([]);
    expect(planTransition("DROPPED", "PAUSED")).toEqual([]);
  });

  it("does not remove completed when leaving completed (add-only)", () => {
    expect(planTransition("COMPLETED", "PAUSED")).toEqual([]);
    expect(planTransition("COMPLETED", "DROPPED")).toEqual([]);
  });
});

describe("planRemoveProgress", () => {
  it("returns no ops for null status", () => {
    expect(planRemoveProgress(null)).toEqual([]);
  });

  it("removes from mirrored shelf", () => {
    expect(planRemoveProgress("BACKLOG")).toEqual([
      { kind: "remove", shelfKey: "backlog" },
    ]);
    expect(planRemoveProgress("ACTIVE")).toEqual([
      { kind: "remove", shelfKey: "active" },
    ]);
  });

  it("does not touch completed shelf (add-only)", () => {
    expect(planRemoveProgress("COMPLETED")).toEqual([]);
  });

  it("returns no ops for non-mirrored statuses", () => {
    expect(planRemoveProgress("PAUSED")).toEqual([]);
    expect(planRemoveProgress("DROPPED")).toEqual([]);
  });
});
