import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "../../test/prisma-client-mock";

installPrismaClientMock();

const userFindUniqueOrThrow = mock(async () => ({
  settings: {},
}));
const userUpdate = mock(async (_input: unknown) => ({}));

beforeEach(() => {
  userFindUniqueOrThrow.mockReset();
  userFindUniqueOrThrow.mockResolvedValue({ settings: {} });
  userUpdate.mockReset();

  Object.assign(prismaMock, {
    user: {
      findUniqueOrThrow: userFindUniqueOrThrow,
      update: userUpdate,
    },
  });
});

describe("settings preferred languages", () => {
  test("normalizes empty settings to the fallback language", async () => {
    const { getSettings } = await import("./settings.service");

    await expect(getSettings("user-1")).resolves.toMatchObject({
      preferredLanguages: ["en"],
    });
  });

  test("normalizes and deduplicates preferred language updates", async () => {
    const { updateSettings } = await import("./settings.service");

    const result = await updateSettings("user-1", {
      preferredLanguages: ["JA", "ja", "en"],
    } as never);

    expect(result.preferredLanguages).toEqual(["ja", "en"]);
    expect(userUpdate.mock.calls[0]?.[0]).toMatchObject({
      where: { unitId: "user-1" },
      data: { settings: { preferredLanguages: ["ja", "en"] } },
    });
  });

  test("empty preferred language updates are normalized to the fallback", async () => {
    const { updateSettings } = await import("./settings.service");

    const result = await updateSettings("user-1", {
      preferredLanguages: [],
    });

    expect(result.preferredLanguages).toEqual(["en"]);
  });
});
