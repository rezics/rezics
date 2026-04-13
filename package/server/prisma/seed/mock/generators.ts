/** biome-ignore-all lint/correctness/noUnusedImports: <any> */
import {
  Faker,
  base,
  de,
  en,
  faker,
  ja,
  zh_CN,
  zh_TW,
} from "@faker-js/faker";
import {
  type Language,
  LANGUAGES,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/generated/client.js";
import { PostKind, UnitType } from "#/prisma/generated/client.js";
import {
  getDescriptionPool,
  getSummaryPool,
  getTitlePool,
} from "./data/text/index.js";
import {
  generateParagraph,
  generateTitle,
  randomBoolean,
  randomFloat,
  randomInt,
} from "./utils.js";

// ── Faker Locale Instances ─────────────────────────────

const fakerInstances: Record<Language, Faker> = {
  [LANGUAGES.ZH_HANT]: new Faker({ locale: [zh_TW, en, base] }),
  [LANGUAGES.ZH_HANS]: new Faker({ locale: [zh_CN, en, base] }),
  [LANGUAGES.EN]: new Faker({ locale: [en, base] }),
  [LANGUAGES.JA]: new Faker({ locale: [ja, en, base] }),
  [LANGUAGES.DE]: new Faker({ locale: [de, en, base] }),
};

/** Get the locale-appropriate faker instance for a language. */
export function getFaker(lang: Language): Faker {
  return fakerInstances[lang];
}

// ── Language Distribution ──────────────────────────────

/** Languages beyond zh-hant and their inclusion probability. */
const LANG_DISTRIBUTION: [Language, number][] = [
  [LANGUAGES.EN, 0.7],
  [LANGUAGES.ZH_HANS, 0.4],
  [LANGUAGES.JA, 0.2],
  [LANGUAGES.DE, 0.1],
];

// ── Multilingual Translation ───────────────────────────

export interface TranslationData {
  language: Language;
  title: string;
  subtitle?: string;
  summary?: string;
  description?: string;
  extra?: Prisma.InputJsonValue;
}

/**
 * Pick title/summary/description from the curated text corpus.
 * Falls back to faker lorem for descriptions if the corpus is exhausted.
 */
function pickFromCorpus(
  type: UnitType,
  lang: Language,
): Omit<TranslationData, "language"> {
  const f = getFaker(lang);

  // Map UnitType to text pool type
  const poolType =
    type === UnitType.TAG || type === UnitType.POST || type === UnitType.CHAPTER
      ? "BOOK"
      : type === UnitType.LINK
        ? "BOOK"
        : type;

  const titles = getTitlePool(lang, poolType);
  const summaries = getSummaryPool(lang);
  const descriptions = getDescriptionPool(lang);

  const title = f.helpers.arrayElement([...titles]);

  switch (type) {
    case UnitType.BOOK:
      return {
        title,
        subtitle: randomBoolean(0.3)
          ? f.helpers.arrayElement([...titles])
          : undefined,
        summary: f.helpers.arrayElement([...summaries]),
        description: f.helpers.arrayElement([...descriptions]),
      };
    case UnitType.GAME:
      return {
        title,
        summary: f.helpers.arrayElement([...summaries]),
        description: f.helpers.arrayElement([...descriptions]),
      };
    case UnitType.MEDIA:
      return {
        title,
        summary: f.helpers.arrayElement([...summaries]),
        description: f.helpers.arrayElement([...descriptions]),
      };
    case UnitType.TAG:
      return { title };
    case UnitType.SHELF:
      return {
        title,
        description: randomBoolean(0.6)
          ? f.helpers.arrayElement([...summaries])
          : undefined,
      };
    case UnitType.REALM:
      return {
        title,
        description: f.helpers.arrayElement([...summaries]),
      };
    case UnitType.CHAPTER:
      return {
        title,
        description: randomBoolean(0.2)
          ? f.helpers.arrayElement([...summaries])
          : undefined,
      };
    case UnitType.POST:
      return {
        title: randomBoolean(0.5) ? title : f.helpers.arrayElement([...titles]),
        description: randomBoolean(0.3)
          ? f.helpers.arrayElement([...summaries])
          : undefined,
      };
    default:
      return { title };
  }
}

/**
 * Generate multilingual translations for a unit.
 *
 * Always includes zh-hant (platform default). Other languages
 * are included probabilistically:
 * - en: ~70%
 * - zh-hans: ~40%
 * - ja: ~20%
 * - de: ~10%
 */
export function generateTranslations(type: UnitType): TranslationData[] {
  const result: TranslationData[] = [];

  // zh-hant always included
  result.push({
    language: LANGUAGES.ZH_HANT,
    ...pickFromCorpus(type, LANGUAGES.ZH_HANT),
  });

  // Other languages by probability
  for (const [lang, prob] of LANG_DISTRIBUTION) {
    if (Math.random() < prob) {
      result.push({
        language: lang,
        ...pickFromCorpus(type, lang),
      });
    }
  }

  return result;
}

// ── Legacy single-language generator (kept for compatibility) ──

export function generateTranslation(type: UnitType): TranslationData {
  return {
    language: LANGUAGES.ZH_HANT,
    ...pickFromCorpus(type, LANGUAGES.ZH_HANT),
  };
}

// ── Book ───────────────────────────────────────────────

export function generateBookExtra(): Prisma.InputJsonValue {
  return {
    publisher: faker.company.name(),
    year: faker.date.past({ years: 45 }).getFullYear(),
    language: faker.helpers.arrayElement(["en", "zh", "es", "fr", "de", "ja"]),
    format: faker.helpers.arrayElement(["paperback", "hardcover", "ebook"]),
  };
}

// ── Game ────────────────────────────────────────────

export function generateGameExtra(): Prisma.InputJsonValue {
  return {
    developer: faker.company.name(),
    engine: faker.helpers.arrayElement([
      "Unity",
      "Unreal",
      "Godot",
      "RPGMaker",
      "Custom",
    ]),
    multiplayer: randomBoolean(0.4),
  };
}

// ── Media ───────────────────────────────────────────

export function generateMediaExtra(): Prisma.InputJsonValue {
  return {
    studio: faker.company.name(),
    director: faker.person.fullName(),
    language: faker.helpers.arrayElement(["en", "zh", "ja", "ko", "es"]),
  };
}

// ── Post body ───────────────────────────────────────

export function generatePostBody(kind: PostKind): string {
  switch (kind) {
    case PostKind.REVIEW:
      return generateParagraph(5, 15);
    case PostKind.COMMENT:
      return generateParagraph(1, 4);
    case PostKind.QUOTE:
      return faker.lorem.sentences({ min: 1, max: 3 });
    case PostKind.REMARK:
      return generateParagraph(1, 3);
    case PostKind.POST:
      return generateParagraph(2, 8);
  }
}

// ── Post extra ──────────────────────────────────────

export function generatePostExtra(
  kind: PostKind,
): Prisma.InputJsonValue | null {
  switch (kind) {
    case PostKind.REVIEW:
      return { rating: Math.round(randomFloat(1, 5) * 10) / 10 };
    case PostKind.QUOTE:
      return { source: faker.lorem.sentence() };
    case PostKind.REMARK:
      return { rating: Math.round(randomFloat(1, 5) * 10) / 10 };
    default:
      return null;
  }
}
