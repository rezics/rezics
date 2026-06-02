import { describe, expect, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";

function setServerEnvForSearchTests() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/rezics_book";
  process.env.AUTH_INTERNAL_BASE_URL ??= "http://localhost:4001";
  process.env.AUTH_PUBLIC_BASE_URL ??= "http://localhost:4001";
  process.env.AUTH_PUBLIC_ISSUER_URL ??= "http://localhost:4001";
  process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "test-secret";
  process.env.SMTP_HOST ??= "localhost";
  process.env.SMTP_USER ??= "test";
  process.env.SMTP_PASSWORD ??= "test";
  process.env.TURNSTILE_SECRET ??= "test";
  process.env.MEILI_HOST ??= "http://localhost:7700";
  process.env.MEILI_MASTER_KEY ??= "masterKey";
  process.env.NOTIFY_BASE_URL ??= "http://localhost:4002";
  process.env.NOTIFY_INTERNAL_SECRET ??= "test-secret";
  process.env.REACTION_BASE_URL ??= "http://localhost:4003";
  process.env.REACTION_INTERNAL_SECRET ??= "test-secret";
}

const baseUnit = {
  id: "unit-1",
  type: "BOOK",
  defaultLanguage: "en",
  visibility: "PUBLIC",
  rating: "GENERAL",
  aiDisclosureMode: "UNKNOWN",
  userId: "user-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  publishedAt: null,
  translations: [
    { language: "en", title: "The Three-Body Problem", extra: null },
  ],
  aliases: [],
  unitTags: [],
  inRealms: [],
  realmTagApplicationsAsTargetUnit: [],
  creditAttributions: [],
  subjectAttributions: [],
  book: { textLength: 100, isLicensed: false },
};

describe("alias and pinned tag search projection", () => {
  test("indexes visible aliases separately from translation titles", async () => {
    setServerEnvForSearchTests();
    const { buildContentDocument } = await import("./sync");

    const doc = buildContentDocument({
      ...baseUnit,
      aliases: [
        { value: "3 Body Problem", score: 1, pinned: false, status: "ACTIVE" },
        {
          value: "Pinned Bad Alias",
          score: -120,
          pinned: true,
          status: "ACTIVE",
        },
        {
          value: "Rejected Alias",
          score: -120,
          pinned: false,
          status: "ACTIVE",
        },
        { value: "Hidden Alias", score: 200, pinned: true, status: "HIDDEN" },
      ],
    });

    expect(doc.titles).toEqual(["The Three-Body Problem"]);
    expect(doc.aliasValues).toEqual(["3 Body Problem", "Pinned Bad Alias"]);
  });

  test("includes pinned low-score UnitTags without boosting stored score", async () => {
    setServerEnvForSearchTests();
    const { buildContentDocument } = await import("./sync");

    const doc = buildContentDocument({
      ...baseUnit,
      unitTags: [
        {
          tagUnitId: "tag-pinned",
          score: -120,
          pinned: true,
          tag: { translations: [{ title: "Pinned tag" }] },
        },
        {
          tagUnitId: "tag-hidden",
          score: -120,
          pinned: false,
          tag: { translations: [{ title: "Hidden tag" }] },
        },
      ],
    });

    expect(doc.tagIds).toEqual(["tag-pinned"]);
    expect(doc.tagLabels).toEqual(["Pinned tag"]);
    expect(doc.tagScores).toEqual({ "tag-pinned": -120 });
  });

  test("entity and realm aliases do not replace display translation titles", async () => {
    setServerEnvForSearchTests();
    const { buildEntityDocument, buildRealmDocument } = await import("./sync");

    const entityDoc = buildEntityDocument({
      unitId: "entity-1",
      kind: "person",
      avatar: null,
      verified: true,
      eligibleCreditRoles: [],
      eligibleSubjectRoles: [],
      unit: {
        slug: "liu-cixin",
        userId: "user-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        translations: [{ language: "en", title: "Liu Cixin", summary: null }],
        aliases: [
          { value: "Cixin Liu", score: -120, pinned: true, status: "ACTIVE" },
        ],
      },
    });

    const realmDoc = buildRealmDocument({
      unitId: "realm-1",
      isPublic: true,
      isOfficial: false,
      memberCount: 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      extra: null,
      unit: {
        userId: "user-1",
        translations: [{ language: "en", title: "rezics", description: null }],
        aliases: [
          {
            value: "Library.Book",
            score: -120,
            pinned: true,
            status: "ACTIVE",
          },
        ],
      },
    });

    expect(entityDoc.titles).toEqual(["Liu Cixin"]);
    expect(entityDoc.aliasValues).toEqual(["Cixin Liu"]);
    expect(realmDoc.titles).toEqual(["rezics"]);
    expect(realmDoc.aliasValues).toEqual(["Library.Book"]);
  });

  test("realm documents expose translation descriptions as plain markdown text", async () => {
    setServerEnvForSearchTests();
    const { buildRealmDocument } = await import("./sync");

    const doc = buildRealmDocument({
      unitId: "realm-1",
      isPublic: true,
      isOfficial: false,
      memberCount: 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      extra: null,
      unit: {
        userId: "user-1",
        translations: [
          {
            language: "en",
            title: "Realm",
            description: markdownContentDoc("Readable realm summary"),
          },
          {
            language: "zh-hant",
            title: "Realm",
            description: "Legacy plain summary",
          },
        ],
        aliases: [],
      },
    });

    expect(doc.descriptions).toEqual([
      "Readable realm summary",
      "Legacy plain summary",
    ]);
    expect(doc.translations.map((tr) => tr.description)).toEqual([
      "Readable realm summary",
      "Legacy plain summary",
    ]);
  });
});
