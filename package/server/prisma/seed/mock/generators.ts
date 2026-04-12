/** biome-ignore-all lint/correctness/noUnusedImports: <any> */
import { faker } from "@faker-js/faker";
import type { Prisma } from "#/prisma/generated/client.js";
import { PostKind, UnitType } from "#/prisma/generated/client.js";
import {
  generateParagraph,
  generateTitle,
  randomBoolean,
  randomFloat,
  randomInt,
} from "./utils.js";

// ── Book ────────────────────────────���───────────────

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

// ── Media ────────────────────────────────��──────────

export function generateMediaExtra(): Prisma.InputJsonValue {
  return {
    studio: faker.company.name(),
    director: faker.person.fullName(),
    language: faker.helpers.arrayElement(["en", "zh", "ja", "ko", "es"]),
  };
}

// ── Translation ─────────────────────────────────────

export interface TranslationData {
  title: string;
  subtitle?: string;
  summary?: string;
  description?: string;
  extra?: Prisma.InputJsonValue;
}

export function generateTranslation(type: UnitType): TranslationData {
  switch (type) {
    case UnitType.BOOK:
      return {
        title: generateTitle(2, 5),
        subtitle: randomBoolean(0.3) ? generateTitle(3, 6) : undefined,
        summary: generateParagraph(1, 2),
        description: generateParagraph(2, 5),
      };
    case UnitType.GAME:
      return {
        title: generateTitle(1, 4),
        summary: generateParagraph(1, 2),
        description: generateParagraph(2, 4),
      };
    case UnitType.MEDIA:
      return {
        title: generateTitle(1, 5),
        summary: generateParagraph(1, 2),
        description: generateParagraph(2, 4),
      };
    case UnitType.TAG:
      return {
        title: `${faker.word.adjective()} ${faker.word.noun()}`,
      };
    case UnitType.SHELF:
      return {
        title: generateTitle(2, 4),
        description: randomBoolean(0.6) ? generateParagraph(1, 3) : undefined,
      };
    case UnitType.REALM:
      return {
        title: generateTitle(1, 3),
        description: generateParagraph(1, 3),
      };
    case UnitType.CHAPTER:
      return {
        title: generateTitle(2, 6),
        description: randomBoolean(0.2) ? generateParagraph(1, 3) : undefined,
      };
    case UnitType.POST:
      return {
        title: randomBoolean(0.5) ? generateTitle(3, 6) : generateTitle(2, 4),
        description: randomBoolean(0.3) ? generateParagraph(1, 2) : undefined,
      };
    default:
      return {
        title: generateTitle(2, 6),
      };
  }
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
