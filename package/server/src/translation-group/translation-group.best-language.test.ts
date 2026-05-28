import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const unitFindManyMock = mock(async (): Promise<any[]> => []);
const unitFindUniqueMock = mock(async (): Promise<any> => null);
const translationGroupCreateMock = mock(async () => ({ id: "tg-1" }));
const translationGroupUpdateMock = mock(async () => undefined);
const translationGroupDeleteMock = mock(async () => undefined);
const unitUpdateMock = mock(async () => undefined);
const unitCreateMock = mock(async () => ({ id: "wiki-ja" }));
const unitSupportLanguageUpsertMock = mock(async () => undefined);
const transactionMock = mock(async (fn: any) =>
  fn({
    translationGroup: {
      create: translationGroupCreateMock,
      update: translationGroupUpdateMock,
      delete: translationGroupDeleteMock,
    },
    unit: {
      update: unitUpdateMock,
      create: unitCreateMock,
      findMany: unitFindManyMock,
    },
    unitSupportLanguage: {
      upsert: unitSupportLanguageUpsertMock,
    },
  }),
);
const enqueueMock = mock(async () => ({ status: "created" }));

installPrismaClientMock();
Object.assign(prismaMock, {
  $transaction: transactionMock,
  unit: {
    findMany: unitFindManyMock,
    findUnique: unitFindUniqueMock,
  },
});

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
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
    unitFindUniqueMock.mockClear();
    unitFindUniqueMock.mockImplementation(async () => null);
    translationGroupCreateMock.mockClear();
    translationGroupUpdateMock.mockClear();
    translationGroupDeleteMock.mockClear();
    unitUpdateMock.mockClear();
    unitCreateMock.mockClear();
    unitCreateMock.mockResolvedValue({ id: "wiki-ja" });
    unitSupportLanguageUpsertMock.mockClear();
    transactionMock.mockClear();
    enqueueMock.mockClear();
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

  test("attach syncs content documents whose translationGroupId changed", async () => {
    unitFindUniqueMock.mockResolvedValueOnce({
      id: "wiki-en",
      type: "POST",
      defaultLanguage: "en",
      translationGroupId: null,
    });

    await service.attachTranslation(
      "wiki-en",
      { language: "ja", content: null },
      "author-1",
    );

    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.post.sync",
      "search.content.sync",
      "search.content.sync",
    ]);
    expect(enqueueMock.mock.calls.map((call) => call[0].payload)).toEqual([
      { postId: "wiki-ja" },
      { unitId: "wiki-en" },
      { unitId: "wiki-ja" },
    ]);
  });

  test("detach syncs the detached content document", async () => {
    unitFindUniqueMock.mockResolvedValueOnce({
      id: "wiki-ja",
      defaultLanguage: "ja",
      translationGroupId: "tg-1",
    });
    unitFindManyMock.mockResolvedValueOnce([{ defaultLanguage: "en" }]);

    await service.detachTranslation("wiki-ja");

    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.post.sync",
      "search.content.sync",
    ]);
    expect(enqueueMock.mock.calls.map((call) => call[0].payload)).toEqual([
      { postId: "wiki-ja" },
      { unitId: "wiki-ja" },
    ]);
  });
});
