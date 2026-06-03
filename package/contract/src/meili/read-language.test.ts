import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { ContentSearchOptionsSchema } from "./content";
import { PollSearchOptionsSchema } from "./poll";
import { PostSearchOptionsSchema } from "./post";
import { RealmSearchOptionsSchema } from "./realm";
import { FederatedSearchOptionsSchema } from "../search/federated";
import { SearchQuerySchema } from "../search/search";

const localizedQuery = {
  languages: ["ja", "en"],
  appLocale: "en",
  languageMode: "preferred",
} as const;

describe("Meilisearch read-language contract", () => {
  test("direct localized search options accept ordered language candidates", () => {
    for (const schema of [
      ContentSearchOptionsSchema,
      PostSearchOptionsSchema,
      RealmSearchOptionsSchema,
      PollSearchOptionsSchema,
    ]) {
      expect(Value.Check(schema, localizedQuery)).toBe(true);
      expect(
        Value.Check(schema, { ...localizedQuery, languageMode: "all" }),
      ).toBe(true);
    }
  });

  test("federated search carries the same read-language query shape", () => {
    expect(
      Value.Check(FederatedSearchOptionsSchema, {
        scope: { kind: "global" },
        category: "mixed",
        query: {
          keyword: "magic",
          ...localizedQuery,
        },
      }),
    ).toBe(true);
  });

  test("omitted languageMode uses the endpoint default while invalid modes fail", () => {
    expect(
      Value.Check(SearchQuerySchema, {
        languages: ["ja", "en"],
        appLocale: "en",
      }),
    ).toBe(true);
    expect(
      Value.Check(SearchQuerySchema, {
        languages: ["ja", "en"],
        appLocale: "en",
        languageMode: "only-mine",
      }),
    ).toBe(false);
  });

  test("read-language POST bodies use arrays, not CSV query strings", () => {
    expect(
      Value.Check(ContentSearchOptionsSchema, {
        languages: ["ja", "en"],
      }),
    ).toBe(true);
    expect(
      Value.Check(ContentSearchOptionsSchema, {
        languages: "ja,en",
      }),
    ).toBe(false);
  });
});
