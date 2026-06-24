import { describe, expect, test } from "bun:test";
import {
  realmContextPostEditHref,
  realmContextPostHref,
} from "./realmPostContext";

describe("realm post context helpers", () => {
  test("builds long realm-context post links for stream cards", () => {
    expect(
      realmContextPostHref({ realmId: "realm-1", postUnitId: "post-1" }),
    ).toBe("/realm/realm-1/post/post-1");
  });

  test("builds realm-context post edit links", () => {
    expect(
      realmContextPostEditHref({ realmId: "realm-1", postUnitId: "post-1" }),
    ).toBe("/realm/realm-1/post/post-1/edit");
  });
});
