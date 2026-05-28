import { describe, expect, test } from "bun:test";
import { buildNotificationTarget } from "./notification.target";

describe("buildNotificationTarget", () => {
  test("prefers node route when bookId + nodeId are present", () => {
    expect(
      buildNotificationTarget("chapter.updated", {
        bookId: "b1",
        nodeId: "n2",
        chapterId: "c3",
        anchor: "para-4",
      }),
    ).toEqual({
      route: "/book/:bookId/node/:nodeId",
      params: { bookId: "b1", nodeId: "n2" },
      anchor: "para-4",
    });
  });

  test("falls back to read route for chapter Unit in a book context", () => {
    expect(
      buildNotificationTarget("comment.new", { bookId: "b1", chapterId: "c3" }),
    ).toEqual({
      route: "/book/:bookId/read/:chapterId",
      params: { bookId: "b1", chapterId: "c3" },
    });
  });

  test("uses chapter-only route when no book context", () => {
    expect(
      buildNotificationTarget("reaction.like", { contentUnitId: "u9" }),
    ).toEqual({
      route: "/chapter/:contentUnitId",
      params: { contentUnitId: "u9" },
    });
  });

  test("routes follow notifications to the actor profile", () => {
    expect(
      buildNotificationTarget("follow.new", { profileSlug: "alice" }),
    ).toEqual({ route: "/u/:userSlug", params: { userSlug: "alice" } });
  });

  test("routes realm member/announcement events to the realm", () => {
    expect(
      buildNotificationTarget("member.joined", {
        realmId: "r1",
        realmTab: "members",
      }),
    ).toEqual({
      route: "/realm/:realmId",
      params: { realmId: "r1" },
      anchor: "members",
    });
  });

  test("returns undefined without usable hints", () => {
    expect(buildNotificationTarget("system.notice", undefined)).toBeUndefined();
    expect(buildNotificationTarget("comment.new", {})).toBeUndefined();
  });
});
