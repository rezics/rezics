import { afterEach, describe, expect, test } from "bun:test";
import {
  clearRealmManageModeSessionOverrides,
  getRealmManageModeAccountDefault,
  getRealmManageModeInitialValue,
  setRealmManageModeSessionOverride,
} from "./realmManageMode";

describe("realm manage mode", () => {
  afterEach(() => clearRealmManageModeSessionOverrides());

  test("defaults account preference on", () => {
    expect(getRealmManageModeAccountDefault(undefined)).toBe(true);
    expect(getRealmManageModeAccountDefault({})).toBe(true);
    expect(
      getRealmManageModeAccountDefault({
        moderation: { realmManageModeDefault: false },
      }),
    ).toBe(false);
  });

  test("session overrides apply only to the current realm", () => {
    setRealmManageModeSessionOverride("realm-a", true);
    expect(
      getRealmManageModeInitialValue({
        realmId: "realm-a",
        settings: { moderation: { realmManageModeDefault: false } },
      }),
    ).toBe(true);
    expect(
      getRealmManageModeInitialValue({
        realmId: "realm-b",
        settings: { moderation: { realmManageModeDefault: false } },
      }),
    ).toBe(false);
  });
});
