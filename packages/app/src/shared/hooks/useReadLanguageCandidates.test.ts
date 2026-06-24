import { describe, expect, mock, test } from "bun:test";

mock.module("@/user/states", () => ({
  selectHasMemberSession: () => false,
  useAuthSessionStore: () => false,
}));

const { appLocaleSeedFromPreferred } = await import(
  "./useReadLanguageCandidates"
);

describe("appLocaleSeedFromPreferred", () => {
  test("seeds from first preferred language only when no local app locale exists", () => {
    expect(
      appLocaleSeedFromPreferred({
        hasMemberSession: true,
        preferredLanguages: ["zh-Hant", "en"],
        storedLocale: null,
      }),
    ).toBe("zh-hant");

    expect(
      appLocaleSeedFromPreferred({
        hasMemberSession: true,
        preferredLanguages: ["zh-hant"],
        storedLocale: "en",
      }),
    ).toBeNull();
  });

  test("does not seed for guests or empty preferences", () => {
    expect(
      appLocaleSeedFromPreferred({
        hasMemberSession: false,
        preferredLanguages: ["zh-hant"],
        storedLocale: null,
      }),
    ).toBeNull();

    expect(
      appLocaleSeedFromPreferred({
        hasMemberSession: true,
        preferredLanguages: [],
        storedLocale: null,
      }),
    ).toBeNull();
  });
});
