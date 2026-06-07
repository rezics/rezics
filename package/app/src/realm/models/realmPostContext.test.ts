import { describe, expect, test } from "bun:test";
import {
  realmContextPostEditHref,
  realmContextPostHref,
  realmContextReactionScopeKey,
} from "./realmPostContext";

describe("realm post context helpers", () => {
  test("builds long realm-context post links for feed cards", () => {
    expect(
      realmContextPostHref({ realmId: "realm-1", postUnitId: "post-1" }),
    ).toBe("/realm/realm-1/post/post-1");
  });

  test("builds realm-context post edit links", () => {
    expect(
      realmContextPostEditHref({ realmId: "realm-1", postUnitId: "post-1" }),
    ).toBe("/realm/realm-1/post/post-1/edit");
  });

  test("uses the realm reaction scope for feed card reactions", () => {
    expect(realmContextReactionScopeKey("realm-1")).toBe("realm:realm-1");
  });
});
