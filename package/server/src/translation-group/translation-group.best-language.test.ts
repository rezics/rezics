import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const unitFindManyMock = mock(async (): Promise<any[]> => []);

installPrismaClientMock();
Object.assign(prismaMock, {
  unit: {
    findMany: unitFindManyMock,
  },
});

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: mock(async () => ({ status: "created" })),
  },
}));

mock.module("@/utils/errors", () => ({
  AppError: class AppError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

const { TranslationGroupService } = await import("./translation-group.service");

describe("TranslationGroupService best-language wiki selection", () => {
  const service = new TranslationGroupService();

  beforeEach(() => {
    unitFindManyMock.mockClear();
    unitFindManyMock.mockImplementation(async () => []);
  });

  test("selects exact preferred WIKI language when available", async () => {
    unitFindManyMock.mockImplementation(async () => [
      {
        id: "wiki-en",
        translationGroupId: "tg-1",
        defaultLanguage: "en",
      },
      {
        id: "wiki-ja",
        translationGroupId: "tg-1",
        defaultLanguage: "ja",
      },
    ]);

    const result = await service.resolveBestLanguageWikiPosts({
      translationGroupIds: ["tg-1"],
      preferredLanguages: ["ja", "en"],
    });

    expect(result).toEqual([
      {
        translationGroupId: "tg-1",
        unitId: "wiki-ja",
        defaultLanguage: "ja",
      },
    ]);
    expect(unitFindManyMock).toHaveBeenCalledWith({
      where: {
        translationGroupId: { in: ["tg-1"] },
        type: "POST",
        status: "PUBLISHED",
        post: { kind: "WIKI" },
      },
      select: {
        id: true,
        translationGroupId: true,
        defaultLanguage: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  });

  test("falls back deterministically when no preferred language matches", async () => {
    unitFindManyMock.mockImplementation(async () => [
      {
        id: "wiki-en",
        translationGroupId: "tg-1",
        defaultLanguage: "en",
      },
      {
        id: "wiki-zh",
        translationGroupId: "tg-1",
        defaultLanguage: "zh-hant",
      },
    ]);

    const result = await service.resolveBestLanguageWikiPosts({
      translationGroupIds: ["tg-1"],
      preferredLanguages: ["ko"],
    });

    expect(result).toEqual([
      {
        translationGroupId: "tg-1",
        unitId: "wiki-en",
        defaultLanguage: "en",
      },
    ]);
  });
});
