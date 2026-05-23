import { faker } from "@faker-js/faker";
import { LANGUAGES, markdownContentDoc, type Language } from "@rezics/contract";
import {
  generateParagraph,
  getDescriptionPool,
  getFaker,
  getSummaryPool,
  getTitlePool,
  LANG_DISTRIBUTION,
} from "@rezics/shared/text";
import type { Prisma } from "../generated/client.js";
import { PostKind, UnitType } from "../generated/client.js";
import { randomBoolean, randomFloat } from "./utils.js";

export { getFaker };

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
    type === UnitType.TAG || type === UnitType.POST
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
      return {
        title,
        description: f.helpers.arrayElement([...summaries]),
      };
    case UnitType.ENTITY:
      return {
        title,
        description: f.helpers.arrayElement([...summaries]),
      };
    case UnitType.ZONE:
      return {
        title,
        description: f.helpers.arrayElement([...summaries]),
      };
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
    case PostKind.EXCERPT:
      return faker.lorem.sentences({ min: 1, max: 3 });
    case PostKind.REMARK:
      return generateParagraph(1, 3);
    case PostKind.POST:
      return generateParagraph(2, 8);
    case PostKind.CHAPTER:
      return generateParagraph(8, 25);
    case PostKind.WIKI:
      return generateParagraph(3, 8);
  }
}

export function generatePostContent(kind: PostKind): Prisma.InputJsonValue {
  return markdownContentDoc(generatePostBody(kind)) as Prisma.InputJsonValue;
}

// ── Post extra ──────────────────────────────────────

export function generatePostExtra(
  kind: PostKind,
): Prisma.InputJsonValue | null {
  switch (kind) {
    case PostKind.REVIEW:
      return { rating: Math.round(randomFloat(1, 5) * 10) / 10 };
    case PostKind.EXCERPT:
      return {
        source: {
          mode: "url",
          url: faker.internet.url(),
          title: faker.lorem.sentence({ min: 2, max: 6 }).slice(0, 200),
        },
      };
    case PostKind.REMARK:
      return { rating: Math.round(randomFloat(1, 5) * 10) / 10 };
    default:
      return null;
  }
}
