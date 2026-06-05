import { describe, expect, test } from "bun:test";
import {
  buildPollDocument,
  setSearchDb,
  syncAllPolls,
  syncSinglePoll,
} from "./sync";

function createDb(rowSets: unknown[][]) {
  const createChain = () => ({
    then(resolve: (value: unknown[]) => unknown) {
      return Promise.resolve(resolve(rowSets.shift() ?? []));
    },
    leftJoin() {
      return createChain();
    },
    where() {
      return createChain();
    },
    orderBy() {
      return createChain();
    },
    async limit() {
      return rowSets.shift() ?? [];
    },
  });

  return {
    select() {
      return {
        from() {
          return createChain();
        },
      };
    },
  };
}

const pollBaseRow = {
  unitId: "poll-1",
  voteMode: "SINGLE",
  resultVisibility: "LIVE",
  anonymous: false,
  closesAt: new Date("2026-06-01T00:00:00.000Z"),
  usageCount: 2,
  createdAt: new Date("2026-05-31T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  unitStatus: "PUBLISHED",
  userId: "user-1",
  isLanguageNeutral: false,
};

const pollOptions = [
  { pollUnitId: "poll-1", label: "Novel", unitId: null, position: "a0" },
  { pollUnitId: "poll-1", label: null, unitId: "book-1", position: "a1" },
];

const pollTranslations = [
  {
    unitId: "poll-1",
    language: "en",
    title: "Reading poll",
    summary: "Pick a weekend book",
  },
];

const pollSupportLanguages = [
  { unitId: "poll-1", language: "en", isPrimary: true, sortOrder: 0 },
];

describe("buildPollDocument", () => {
  test("projects title, options, config, usage count, and derived used", () => {
    const doc = buildPollDocument({
      unitId: "poll-1",
      voteMode: "SINGLE",
      resultVisibility: "LIVE",
      anonymous: false,
      closesAt: new Date("2026-06-01T00:00:00.000Z"),
      usageCount: 2,
      createdAt: new Date("2026-05-31T00:00:00.000Z"),
      updatedAt: new Date("2026-06-01T00:00:00.000Z"),
      unit: {
        userId: "user-1",
        supportLanguages: [{ language: "en", isPrimary: true, sortOrder: 0 }],
        translations: [
          {
            language: "en",
            title: "Reading poll",
            summary: "Pick a weekend book",
          },
        ],
      },
      options: [
        { label: "Novel", unitId: null },
        { label: null, unitId: "book-1" },
      ],
    });

    expect(doc).toMatchObject({
      id: "poll-1",
      ownerUserId: "user-1",
      titles: ["Reading poll"],
      descriptions: ["Pick a weekend book"],
      optionLabels: ["Novel"],
      optionUnitIds: ["book-1"],
      usageCount: 2,
      used: true,
      languages: ["en"],
    });
    expect(doc.closed).toBe(true);
  });

  test("projects unused open polls for library filtering", () => {
    const doc = buildPollDocument({
      unitId: "poll-2",
      voteMode: "MULTI",
      resultVisibility: "AFTER_CLOSE",
      anonymous: true,
      closesAt: new Date(Date.now() + 60_000),
      usageCount: 0,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-01T00:00:00.000Z"),
      unit: {
        userId: "user-2",
        supportLanguages: [{ language: "ja", isPrimary: true, sortOrder: 0 }],
        translations: [
          {
            language: "ja",
            title: "読書会アンケート",
            summary: null,
          },
        ],
      },
      options: [
        { label: "Saturday", unitId: null },
        { label: "Sunday", unitId: null },
      ],
    });

    expect(doc).toMatchObject({
      ownerUserId: "user-2",
      voteMode: "MULTI",
      resultVisibility: "AFTER_CLOSE",
      anonymous: true,
      usageCount: 0,
      used: false,
      closed: false,
      languages: ["ja"],
      titles: ["読書会アンケート"],
      optionLabels: ["Saturday", "Sunday"],
    });
  });

  test("does not infer preferred-filter languages from translation-only poll data", () => {
    const doc = buildPollDocument({
      unitId: "poll-unrepaired",
      voteMode: "SINGLE",
      resultVisibility: "LIVE",
      anonymous: false,
      closesAt: null,
      usageCount: 0,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-01T00:00:00.000Z"),
      unit: {
        userId: "user-1",
        supportLanguages: [],
        translations: [
          {
            language: "en",
            title: "Translation-only poll",
            summary: null,
          },
        ],
      },
      options: [],
    });

    expect(doc.languages).toEqual([]);
    expect(doc.titles).toEqual(["Translation-only poll"]);
  });
});

describe("poll search sync", () => {
  test("syncSinglePoll reads Poll graph through Drizzle", async () => {
    const documents: unknown[] = [];
    setSearchDb(
      createDb([
        [pollBaseRow],
        pollOptions,
        pollTranslations,
        pollSupportLanguages,
      ]) as never,
    );

    await syncSinglePoll(
      {
        addOrUpdatePolls: async (input: unknown[]) => {
          documents.push(...input);
        },
      } as never,
      "poll-1",
    );

    expect(documents).toEqual([
      expect.objectContaining({
        id: "poll-1",
        ownerUserId: "user-1",
        titles: ["Reading poll"],
        descriptions: ["Pick a weekend book"],
        optionLabels: ["Novel"],
        optionUnitIds: ["book-1"],
        languages: ["en"],
      }),
    ]);
  });

  test("syncSinglePoll deletes missing or unpublished polls", async () => {
    const deleted: string[] = [];
    setSearchDb(
      createDb([
        [{ ...pollBaseRow, unitStatus: "DRAFT" }],
        [],
        [],
        [],
        [],
      ]) as never,
    );
    const client = {
      deletePolls: async (ids: string[]) => {
        deleted.push(...ids);
      },
    } as never;

    await syncSinglePoll(client, "poll-draft");
    await syncSinglePoll(client, "poll-missing");

    expect(deleted).toEqual(["poll-draft", "poll-missing"]);
  });

  test("syncAllPolls reads published poll batches through Drizzle", async () => {
    const documents: unknown[] = [];
    setSearchDb(
      createDb([
        [pollBaseRow],
        pollOptions,
        pollTranslations,
        pollSupportLanguages,
        [],
      ]) as never,
    );

    const result = await syncAllPolls({
      deleteAllPolls: async () => ({}),
      addOrUpdatePolls: async (input: unknown[]) => {
        documents.push(...input);
      },
    } as never);

    expect(result).toEqual({ message: "syncAllPolls success", totalSynced: 1 });
    expect(documents).toHaveLength(1);
  });
});
