import { base, de, en, Faker, ja, zh_CN, zh_TW } from "@faker-js/faker";
import { LANGUAGES, type Language } from "@rezics/contract";

const fakerInstances: Record<Language, Faker> = {
  [LANGUAGES.ZH_HANT]: new Faker({ locale: [zh_TW, en, base] }),
  [LANGUAGES.ZH_HANS]: new Faker({ locale: [zh_CN, en, base] }),
  [LANGUAGES.EN]: new Faker({ locale: [en, base] }),
  [LANGUAGES.JA]: new Faker({ locale: [ja, en, base] }),
  [LANGUAGES.DE]: new Faker({ locale: [de, en, base] }),
};

/** Locale-appropriate Faker instance for a given language. */
export function getFaker(lang: Language): Faker {
  return fakerInstances[lang];
}

/** Languages beyond zh-hant and their inclusion probability for multilingual generation. */
export const LANG_DISTRIBUTION: readonly [Language, number][] = [
  [LANGUAGES.EN, 0.7],
  [LANGUAGES.ZH_HANS, 0.4],
  [LANGUAGES.JA, 0.2],
  [LANGUAGES.DE, 0.1],
];
