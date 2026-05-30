import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  bestLanguageWikiPostsRequestSchema,
  bestLanguageWikiPostsResponseSchema,
} from "./group";

describe("translation group schemas", () => {
  test("validates best-language wiki post resolution contracts", () => {
    expect(
      Value.Check(bestLanguageWikiPostsRequestSchema, {
        translationGroupIds: ["tg-1", "tg-2"],
        preferredLanguages: ["ja", "en"],
      }),
    ).toBe(true);

    expect(
      Value.Check(bestLanguageWikiPostsResponseSchema, {
        posts: [
          {
            translationGroupId: "tg-1",
            unitId: "wiki-ja",
            defaultLanguage: "ja",
          },
          {
            translationGroupId: "tg-2",
            unitId: "wiki-en",
            defaultLanguage: null,
          },
        ],
      }),
    ).toBe(true);
  });
});
