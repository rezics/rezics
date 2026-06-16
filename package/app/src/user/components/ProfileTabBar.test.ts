import { describe, expect, test } from "bun:test";
import { profileTabPaths } from "../models/profileTabs";

describe("profileTabPaths", () => {
  test("keeps workspace lists out of profile tabs", () => {
    expect(profileTabPaths(false)).not.toContain("/realms");
    expect(profileTabPaths(false)).not.toContain("/zones");
  });

  test("shows progress only on the current user's profile", () => {
    expect(profileTabPaths(true)).toContain("/progress");
    expect(profileTabPaths(false)).not.toContain("/progress");
  });
});
