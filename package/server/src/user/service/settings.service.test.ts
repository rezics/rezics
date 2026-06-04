import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserSettingsRepository } from "./settings.service";

const getSettingsRow = mock(async () => ({}));
const updateSettingsRow = mock(
  async (_userId: string, _settings: unknown) => {},
);

function repository(): UserSettingsRepository {
  return {
    getSettings: getSettingsRow,
    updateSettings: updateSettingsRow,
  };
}

beforeEach(() => {
  getSettingsRow.mockReset();
  getSettingsRow.mockResolvedValue({});
  updateSettingsRow.mockReset();
});

describe("settings preferred languages", () => {
  test("normalizes empty settings to the fallback language", async () => {
    const { getSettings } = await import("./settings.service");

    await expect(getSettings("user-1", repository())).resolves.toMatchObject({
      preferredLanguages: ["en"],
    });
  });

  test("normalizes and deduplicates preferred language updates", async () => {
    const { updateSettings } = await import("./settings.service");

    const result = await updateSettings(
      "user-1",
      {
        preferredLanguages: ["JA", "ja", "en"],
      } as never,
      repository(),
    );

    expect(result.preferredLanguages).toEqual(["ja", "en"]);
    expect(updateSettingsRow).toHaveBeenCalledWith("user-1", {
      preferredLanguages: ["ja", "en"],
    });
  });

  test("empty preferred language updates are normalized to the fallback", async () => {
    const { updateSettings } = await import("./settings.service");

    const result = await updateSettings(
      "user-1",
      {
        preferredLanguages: [],
      },
      repository(),
    );

    expect(result.preferredLanguages).toEqual(["en"]);
  });
});
