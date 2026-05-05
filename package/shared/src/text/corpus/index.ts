import { LANGUAGES, type Language } from "@rezics/contract";
import * as de from "./de.ts";
import * as en from "./en.ts";
import * as ja from "./ja.ts";
import * as zhHans from "./zh-hans.ts";
import * as zhHant from "./zh-hant.ts";

export type UnitTextType = "BOOK" | "GAME" | "MEDIA" | "REALM" | "SHELF";

export interface TextPool {
  titles: Record<UnitTextType, readonly string[]>;
  summaries: readonly string[];
  descriptions: readonly string[];
}

function buildPool(mod: typeof zhHant): TextPool {
  return {
    titles: {
      BOOK: mod.BOOK_TITLES,
      GAME: mod.GAME_TITLES,
      MEDIA: mod.MEDIA_TITLES,
      REALM: mod.REALM_NAMES,
      SHELF: mod.SHELF_NAMES,
    },
    summaries: mod.SUMMARIES,
    descriptions: mod.DESCRIPTIONS,
  };
}

const POOLS: Record<Language, TextPool> = {
  [LANGUAGES.ZH_HANT]: buildPool(zhHant),
  [LANGUAGES.ZH_HANS]: buildPool(zhHans),
  [LANGUAGES.EN]: buildPool(en),
  [LANGUAGES.JA]: buildPool(ja),
  [LANGUAGES.DE]: buildPool(de),
};

/**
 * Title pool for a given language and unit-type-like key.
 * Falls back to BOOK titles for unrecognized keys.
 */
export function getTitlePool(lang: Language, type: string): readonly string[] {
  const pool = POOLS[lang];
  const key = type as UnitTextType;
  return pool.titles[key] ?? pool.titles.BOOK;
}

export function getSummaryPool(lang: Language): readonly string[] {
  return POOLS[lang].summaries;
}

export function getDescriptionPool(lang: Language): readonly string[] {
  return POOLS[lang].descriptions;
}
