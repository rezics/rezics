import { describe, expect, test } from "bun:test";
import type { NotificationItem } from "@rezics/contract";
import { resolveNotificationHref, targetToHref } from "./notificationTarget";

function item(target?: NotificationItem["target"]): NotificationItem {
  return {
    id: "n1",
    kind: "comment.new",
    sourceUnitId: "u1",
    actorIds: ["a1"],
    count: 1,
    read: false,
    latestAt: "2026-05-29T00:00:00.000Z",
    target,
  };
}

describe("resolveNotificationHref", () => {
  test("returns null without a target", () => {
    expect(resolveNotificationHref(item())).toBeNull();
  });

  test("substitutes params into the route template", () => {
    const href = resolveNotificationHref(
      item({
        route: "/book/:bookId/node/:nodeId",
        params: { bookId: "b1", nodeId: "n9" },
      }),
    );
    expect(href).toBe("/book/b1/node/n9");
  });

  test("appends the anchor when present", () => {
    expect(
      targetToHref({
        route: "/book/:bookId/node/:nodeId",
        params: { bookId: "b1", nodeId: "n2" },
        anchor: "comment-5",
      }),
    ).toBe("/book/b1/node/n2#comment-5");
  });

  test("encodes param values and leaves unknown placeholders intact", () => {
    expect(
      targetToHref({
        route: "/u/:slug/x/:missing",
        params: { slug: "a b" },
      }),
    ).toBe("/u/a%20b/x/:missing");
  });
});
