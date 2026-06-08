import { base, de, en, Faker, ja, ko, zh_CN, zh_TW } from "@faker-js/faker";
import { LANGUAGES, type Language } from "@rezics/contract";

const fakerInstances: Record<Language, Faker> = {
  [LANGUAGES.ZH_HANT]: new Faker({ locale: [zh_TW, en, base] }),
  [LANGUAGES.ZH_HANS]: new Faker({ locale: [zh_CN, en, base] }),
  [LANGUAGES.EN]: new Faker({ locale: [en, base] }),
  [LANGUAGES.JA]: new Faker({ locale: [ja, en, base] }),
  [LANGUAGES.DE]: new Faker({ locale: [de, en, base] }),
  [LANGUAGES.KO]: new Faker({ locale: [ko, en, base] }),
};

/** Locale-appropriate Faker instance for a given language. 为指定语言返回相应区域设置的 Faker 实例。 */
export function getFaker(lang: Language): Faker {
  return fakerInstances[lang];
}

/** Languages beyond zh-hant and their inclusion probability for multilingual generation. zh-hant 以外的语言及其在多语言生成中的纳入概率。 */
export const LANG_DISTRIBUTION: readonly [Language, number][] = [
  [LANGUAGES.EN, 0.7],
  [LANGUAGES.ZH_HANS, 0.4],
  [LANGUAGES.JA, 0.2],
  [LANGUAGES.DE, 0.1],
  [LANGUAGES.KO, 0.1],
];
