import type { Language } from "@rezics/contract";
import { LANGUAGES } from "@rezics/contract";
import * as de from "./de.js";
import * as en from "./en.js";
import * as ja from "./ja.js";
import * as zhHans from "./zh-hans.js";
import * as zhHant from "./zh-hant.js";

type UnitTextType = "BOOK" | "GAME" | "MEDIA" | "REALM" | "SHELF";

interface TextPool {
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
 * Get the title pool for a given language and unit type.
 * Falls back to BOOK titles for unrecognized types.
 */
export function getTitlePool(lang: Language, type: string): readonly string[] {
  const pool = POOLS[lang];
  const key = type as UnitTextType;
  return pool.titles[key] ?? pool.titles.BOOK;
}

/** Get the summary pool for a given language. */
export function getSummaryPool(lang: Language): readonly string[] {
  return POOLS[lang].summaries;
}

/** Get the description pool for a given language. */
export function getDescriptionPool(lang: Language): readonly string[] {
  return POOLS[lang].descriptions;
}
