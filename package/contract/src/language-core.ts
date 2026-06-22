// ============================================================
// APP LANGUAGE CODES
// App 语言代码
// ============================================================

export const APP_LANGUAGES = {
  ZH_HANT: "zh-hant",
  ZH_HANS: "zh-hans",
  EN: "en",
  JA: "ja",
  DE: "de",
  KO: "ko",
} as const;

/**
 * Backward-compatible app-locale registry. Content language coverage is wider;
 * use `CONTENT_LANGUAGES` / `ContentLanguage` for authored content.
 */
export const LANGUAGES = APP_LANGUAGES;

export type AppLanguage = (typeof APP_LANGUAGES)[keyof typeof APP_LANGUAGES];
export type Language = AppLanguage;

export type RezicsLanguageRegistryEntry = {
  /**
   * Canonical Rezics content-language slug.
   *
   * This is a product-facing authored-content language identifier, not a
   * detector code and not a locale. Use the shortest canonical BCP-47 form that
   * identifies the language for readers:
   *
   * - Prefer a primary language subtag (`en`, `fr`, `sco`, `ckb`).
   * - Add script only when script changes practical readability (`zh-hant`,
   *   `zh-hans`).
   * - Do not split by country, region, accent, or national standard
   *   (`en-US`, `en-GB`, `pt-BR`, `es-419`).
   * - Do not encode macrolanguage hierarchy in the slug (`yue`, not `zh-yue`).
   *
   * Slugs are flat in the product sense: one selectable language has one
   * canonical slug. Macrolanguage grouping is metadata, not an alias.
   */
  slug: string;
  englishName: string;
  nativeName: string;
  /**
   * ISO 639-1 metadata when the language has a two-letter code. This is not a
   * public alias; public content-language input accepts canonical slugs only.
   */
  iso6391?: string;
  script?: "Hans" | "Hant";
  macrolanguage?: string;
  direction?: "ltr" | "rtl";
  appLocale?: boolean;
  contentLanguage: true;
  /**
   * Optional automatic-detection metadata.
   *
   * `francMin` is the code emitted by franc-min for this language. It is
   * accepted only on the detector path and must not be treated as a public slug
   * alias.
   */
  detection?: {
    francMin: string;
  };
};

// ============================================================
// CONTENT LANGUAGE REGISTRY
// 内容语言注册表
// ============================================================

export const REZICS_LANGUAGE_REGISTRY = [
  {
    slug: "zh-hant",
    englishName: "Traditional Chinese",
    nativeName: "繁體中文",
    detection: { francMin: "cmn" },
    iso6391: "zh",
    script: "Hant",
    appLocale: true,
    contentLanguage: true,
  },
  {
    slug: "zh-hans",
    englishName: "Simplified Chinese",
    nativeName: "简体中文",
    detection: { francMin: "cmn" },
    iso6391: "zh",
    script: "Hans",
    appLocale: true,
    contentLanguage: true,
  },
  {
    slug: "en",
    englishName: "English",
    nativeName: "English",
    detection: { francMin: "eng" },
    iso6391: "en",
    appLocale: true,
    contentLanguage: true,
  },
  {
    slug: "ja",
    englishName: "Japanese",
    nativeName: "日本語",
    detection: { francMin: "jpn" },
    iso6391: "ja",
    appLocale: true,
    contentLanguage: true,
  },
  {
    slug: "de",
    englishName: "German",
    nativeName: "Deutsch",
    detection: { francMin: "deu" },
    iso6391: "de",
    appLocale: true,
    contentLanguage: true,
  },
  {
    slug: "ko",
    englishName: "Korean",
    nativeName: "한국어",
    detection: { francMin: "kor" },
    iso6391: "ko",
    appLocale: true,
    contentLanguage: true,
  },
  {
    slug: "am",
    englishName: "Amharic",
    nativeName: "Amharic",
    detection: { francMin: "amh" },
    iso6391: "am",
    contentLanguage: true,
  },
  {
    slug: "ar",
    englishName: "Standard Arabic",
    nativeName: "Standard Arabic",
    detection: { francMin: "arb" },
    iso6391: "ar",
    direction: "rtl",
    contentLanguage: true,
  },
  {
    slug: "az",
    englishName: "North Azerbaijani",
    nativeName: "North Azerbaijani",
    detection: { francMin: "azj" },
    iso6391: "az",
    contentLanguage: true,
  },
  {
    slug: "be",
    englishName: "Belarusian",
    nativeName: "Belarusian",
    detection: { francMin: "bel" },
    iso6391: "be",
    contentLanguage: true,
  },
  {
    slug: "bn",
    englishName: "Bengali",
    nativeName: "Bengali",
    detection: { francMin: "ben" },
    iso6391: "bn",
    contentLanguage: true,
  },
  {
    slug: "bho",
    englishName: "Bhojpuri",
    nativeName: "Bhojpuri",
    detection: { francMin: "bho" },
    contentLanguage: true,
  },
  {
    slug: "bs",
    englishName: "Bosnian",
    nativeName: "Bosnian",
    detection: { francMin: "bos" },
    iso6391: "bs",
    contentLanguage: true,
  },
  {
    slug: "bg",
    englishName: "Bulgarian",
    nativeName: "Bulgarian",
    detection: { francMin: "bul" },
    iso6391: "bg",
    contentLanguage: true,
  },
  {
    slug: "ceb",
    englishName: "Cebuano",
    nativeName: "Cebuano",
    detection: { francMin: "ceb" },
    contentLanguage: true,
  },
  {
    slug: "cs",
    englishName: "Czech",
    nativeName: "Czech",
    detection: { francMin: "ces" },
    iso6391: "cs",
    contentLanguage: true,
  },
  {
    slug: "ckb",
    englishName: "Central Kurdish",
    nativeName: "Central Kurdish",
    detection: { francMin: "ckb" },
    direction: "rtl",
    contentLanguage: true,
  },
  {
    slug: "el",
    englishName: "Modern Greek",
    nativeName: "Modern Greek",
    detection: { francMin: "ell" },
    iso6391: "el",
    contentLanguage: true,
  },
  {
    slug: "fr",
    englishName: "French",
    nativeName: "French",
    detection: { francMin: "fra" },
    iso6391: "fr",
    contentLanguage: true,
  },
  {
    slug: "ff",
    englishName: "Nigerian Fulfulde",
    nativeName: "Nigerian Fulfulde",
    detection: { francMin: "fuv" },
    iso6391: "ff",
    contentLanguage: true,
  },
  {
    slug: "gu",
    englishName: "Gujarati",
    nativeName: "Gujarati",
    detection: { francMin: "guj" },
    iso6391: "gu",
    contentLanguage: true,
  },
  {
    slug: "ha",
    englishName: "Hausa",
    nativeName: "Hausa",
    detection: { francMin: "hau" },
    iso6391: "ha",
    contentLanguage: true,
  },
  {
    slug: "hi",
    englishName: "Hindi",
    nativeName: "Hindi",
    detection: { francMin: "hin" },
    iso6391: "hi",
    contentLanguage: true,
  },
  {
    slug: "hms",
    englishName: "Southern Qiandong Miao",
    nativeName: "Southern Qiandong Miao",
    detection: { francMin: "hms" },
    contentLanguage: true,
  },
  {
    slug: "hnj",
    englishName: "Hmong Njua",
    nativeName: "Hmong Njua",
    detection: { francMin: "hnj" },
    contentLanguage: true,
  },
  {
    slug: "hr",
    englishName: "Croatian",
    nativeName: "Croatian",
    detection: { francMin: "hrv" },
    iso6391: "hr",
    contentLanguage: true,
  },
  {
    slug: "hu",
    englishName: "Hungarian",
    nativeName: "Hungarian",
    detection: { francMin: "hun" },
    iso6391: "hu",
    contentLanguage: true,
  },
  {
    slug: "ig",
    englishName: "Igbo",
    nativeName: "Igbo",
    detection: { francMin: "ibo" },
    iso6391: "ig",
    contentLanguage: true,
  },
  {
    slug: "ilo",
    englishName: "Iloko",
    nativeName: "Iloko",
    detection: { francMin: "ilo" },
    contentLanguage: true,
  },
  {
    slug: "id",
    englishName: "Indonesian",
    nativeName: "Indonesian",
    detection: { francMin: "ind" },
    iso6391: "id",
    contentLanguage: true,
  },
  {
    slug: "it",
    englishName: "Italian",
    nativeName: "Italian",
    detection: { francMin: "ita" },
    iso6391: "it",
    contentLanguage: true,
  },
  {
    slug: "jv",
    englishName: "Javanese",
    nativeName: "Javanese",
    detection: { francMin: "jav" },
    iso6391: "jv",
    contentLanguage: true,
  },
  {
    slug: "kn",
    englishName: "Kannada",
    nativeName: "Kannada",
    detection: { francMin: "kan" },
    iso6391: "kn",
    contentLanguage: true,
  },
  {
    slug: "kk",
    englishName: "Kazakh",
    nativeName: "Kazakh",
    detection: { francMin: "kaz" },
    iso6391: "kk",
    contentLanguage: true,
  },
  {
    slug: "rw",
    englishName: "Kinyarwanda",
    nativeName: "Kinyarwanda",
    detection: { francMin: "kin" },
    iso6391: "rw",
    contentLanguage: true,
  },
  {
    slug: "koi",
    englishName: "Komi-Permyak",
    nativeName: "Komi-Permyak",
    detection: { francMin: "koi" },
    contentLanguage: true,
  },
  {
    slug: "ln",
    englishName: "Lingala",
    nativeName: "Lingala",
    detection: { francMin: "lin" },
    iso6391: "ln",
    contentLanguage: true,
  },
  {
    slug: "mad",
    englishName: "Madurese",
    nativeName: "Madurese",
    detection: { francMin: "mad" },
    contentLanguage: true,
  },
  {
    slug: "mag",
    englishName: "Magahi",
    nativeName: "Magahi",
    detection: { francMin: "mag" },
    contentLanguage: true,
  },
  {
    slug: "mai",
    englishName: "Maithili",
    nativeName: "Maithili",
    detection: { francMin: "mai" },
    contentLanguage: true,
  },
  {
    slug: "ml",
    englishName: "Malayalam",
    nativeName: "Malayalam",
    detection: { francMin: "mal" },
    iso6391: "ml",
    contentLanguage: true,
  },
  {
    slug: "mr",
    englishName: "Marathi",
    nativeName: "Marathi",
    detection: { francMin: "mar" },
    iso6391: "mr",
    contentLanguage: true,
  },
  {
    slug: "my",
    englishName: "Burmese",
    nativeName: "Burmese",
    detection: { francMin: "mya" },
    iso6391: "my",
    contentLanguage: true,
  },
  {
    slug: "nl",
    englishName: "Dutch",
    nativeName: "Dutch",
    detection: { francMin: "nld" },
    iso6391: "nl",
    contentLanguage: true,
  },
  {
    slug: "ne",
    englishName: "Nepali",
    nativeName: "Nepali",
    detection: { francMin: "npi" },
    iso6391: "ne",
    contentLanguage: true,
  },
  {
    slug: "ny",
    englishName: "Nyanja",
    nativeName: "Nyanja",
    detection: { francMin: "nya" },
    iso6391: "ny",
    contentLanguage: true,
  },
  {
    slug: "pa",
    englishName: "Panjabi",
    nativeName: "Panjabi",
    detection: { francMin: "pan" },
    iso6391: "pa",
    contentLanguage: true,
  },
  {
    slug: "ps",
    englishName: "Northern Pashto",
    nativeName: "Northern Pashto",
    detection: { francMin: "pbu" },
    iso6391: "ps",
    contentLanguage: true,
  },
  {
    slug: "fa",
    englishName: "Iranian Persian",
    nativeName: "Iranian Persian",
    detection: { francMin: "pes" },
    iso6391: "fa",
    direction: "rtl",
    contentLanguage: true,
  },
  {
    slug: "mg",
    englishName: "Plateau Malagasy",
    nativeName: "Plateau Malagasy",
    detection: { francMin: "plt" },
    iso6391: "mg",
    contentLanguage: true,
  },
  {
    slug: "pl",
    englishName: "Polish",
    nativeName: "Polish",
    detection: { francMin: "pol" },
    iso6391: "pl",
    contentLanguage: true,
  },
  {
    slug: "pt",
    englishName: "Portuguese",
    nativeName: "Portuguese",
    detection: { francMin: "por" },
    iso6391: "pt",
    contentLanguage: true,
  },
  {
    slug: "qug",
    englishName: "Chimborazo Highland Quichua",
    nativeName: "Chimborazo Highland Quichua",
    detection: { francMin: "qug" },
    contentLanguage: true,
  },
  {
    slug: "ro",
    englishName: "Romanian",
    nativeName: "Romanian",
    detection: { francMin: "ron" },
    iso6391: "ro",
    contentLanguage: true,
  },
  {
    slug: "rn",
    englishName: "Rundi",
    nativeName: "Rundi",
    detection: { francMin: "run" },
    iso6391: "rn",
    contentLanguage: true,
  },
  {
    slug: "ru",
    englishName: "Russian",
    nativeName: "Russian",
    detection: { francMin: "rus" },
    iso6391: "ru",
    contentLanguage: true,
  },
  {
    slug: "si",
    englishName: "Sinhala",
    nativeName: "Sinhala",
    detection: { francMin: "sin" },
    iso6391: "si",
    contentLanguage: true,
  },
  {
    slug: "skr",
    englishName: "Saraiki",
    nativeName: "Saraiki",
    detection: { francMin: "skr" },
    direction: "rtl",
    contentLanguage: true,
  },
  {
    slug: "so",
    englishName: "Somali",
    nativeName: "Somali",
    detection: { francMin: "som" },
    iso6391: "so",
    contentLanguage: true,
  },
  {
    slug: "sco",
    englishName: "Scots",
    nativeName: "Scots",
    contentLanguage: true,
  },
  {
    slug: "es",
    englishName: "Spanish",
    nativeName: "Spanish",
    detection: { francMin: "spa" },
    iso6391: "es",
    contentLanguage: true,
  },
  {
    slug: "sr",
    englishName: "Serbian",
    nativeName: "Serbian",
    detection: { francMin: "srp" },
    iso6391: "sr",
    contentLanguage: true,
  },
  {
    slug: "su",
    englishName: "Sundanese",
    nativeName: "Sundanese",
    detection: { francMin: "sun" },
    iso6391: "su",
    contentLanguage: true,
  },
  {
    slug: "sv",
    englishName: "Swedish",
    nativeName: "Swedish",
    detection: { francMin: "swe" },
    iso6391: "sv",
    contentLanguage: true,
  },
  {
    slug: "sw",
    englishName: "Swahili",
    nativeName: "Swahili",
    detection: { francMin: "swh" },
    iso6391: "sw",
    contentLanguage: true,
  },
  {
    slug: "ta",
    englishName: "Tamil",
    nativeName: "Tamil",
    detection: { francMin: "tam" },
    iso6391: "ta",
    contentLanguage: true,
  },
  {
    slug: "te",
    englishName: "Telugu",
    nativeName: "Telugu",
    detection: { francMin: "tel" },
    iso6391: "te",
    contentLanguage: true,
  },
  {
    slug: "tl",
    englishName: "Tagalog",
    nativeName: "Tagalog",
    detection: { francMin: "tgl" },
    iso6391: "tl",
    contentLanguage: true,
  },
  {
    slug: "th",
    englishName: "Thai",
    nativeName: "Thai",
    detection: { francMin: "tha" },
    iso6391: "th",
    contentLanguage: true,
  },
  {
    slug: "tr",
    englishName: "Turkish",
    nativeName: "Turkish",
    detection: { francMin: "tur" },
    iso6391: "tr",
    contentLanguage: true,
  },
  {
    slug: "uk",
    englishName: "Ukrainian",
    nativeName: "Ukrainian",
    detection: { francMin: "ukr" },
    iso6391: "uk",
    contentLanguage: true,
  },
  {
    slug: "ur",
    englishName: "Urdu",
    nativeName: "Urdu",
    detection: { francMin: "urd" },
    iso6391: "ur",
    direction: "rtl",
    contentLanguage: true,
  },
  {
    slug: "uz",
    englishName: "Northern Uzbek",
    nativeName: "Northern Uzbek",
    detection: { francMin: "uzn" },
    iso6391: "uz",
    contentLanguage: true,
  },
  {
    slug: "vi",
    englishName: "Vietnamese",
    nativeName: "Vietnamese",
    detection: { francMin: "vie" },
    iso6391: "vi",
    contentLanguage: true,
  },
  {
    slug: "yo",
    englishName: "Yoruba",
    nativeName: "Yoruba",
    detection: { francMin: "yor" },
    iso6391: "yo",
    contentLanguage: true,
  },
  {
    slug: "ms",
    englishName: "Malay",
    nativeName: "Malay",
    detection: { francMin: "zlm" },
    iso6391: "ms",
    contentLanguage: true,
  },
  {
    slug: "zu",
    englishName: "Zulu",
    nativeName: "Zulu",
    detection: { francMin: "zul" },
    iso6391: "zu",
    contentLanguage: true,
  },
  {
    slug: "za",
    englishName: "Yongbei Zhuang",
    nativeName: "Yongbei Zhuang",
    detection: { francMin: "zyb" },
    iso6391: "za",
    contentLanguage: true,
  },
] as const satisfies readonly RezicsLanguageRegistryEntry[];

export type ContentLanguage = (typeof REZICS_LANGUAGE_REGISTRY)[number]["slug"];

export const CONTENT_LANGUAGES = Object.fromEntries(
  REZICS_LANGUAGE_REGISTRY.map((entry) => [
    entry.slug.toUpperCase().replaceAll("-", "_"),
    entry.slug,
  ]),
) as Record<string, ContentLanguage>;

export const APP_LANGUAGE_SLUGS = Object.values(APP_LANGUAGES) as AppLanguage[];
export const CONTENT_LANGUAGE_SLUGS = REZICS_LANGUAGE_REGISTRY.map(
  (entry) => entry.slug,
) as ContentLanguage[];

const CONTENT_BY_SLUG = new Map(
  REZICS_LANGUAGE_REGISTRY.map((entry) => [entry.slug, entry]),
);

const CONTENT_SLUG_TO_CANONICAL = new Map<string, ContentLanguage>();
const FRANC_MIN_TO_CONTENT_SLUG = new Map<string, ContentLanguage>();
for (const entry of REZICS_LANGUAGE_REGISTRY) {
  CONTENT_SLUG_TO_CANONICAL.set(entry.slug.toLowerCase(), entry.slug);
  if ("detection" in entry) {
    FRANC_MIN_TO_CONTENT_SLUG.set(
      entry.detection.francMin.toLowerCase(),
      entry.slug,
    );
  }
}

// ============================================================
// DISPLAY METADATA
// 显示元数据
// ============================================================

export const LANGUAGE_META: Record<
  ContentLanguage,
  { name: string; nativeName: string }
> = Object.fromEntries(
  REZICS_LANGUAGE_REGISTRY.map((entry) => [
    entry.slug,
    { name: entry.englishName, nativeName: entry.nativeName },
  ]),
) as Record<ContentLanguage, { name: string; nativeName: string }>;

// Display label for a language code: "nativeName (code)" or just the code.
// 语言代码的显示标签："本地名称 (code)"或仅代码。
export function languageLabel(code: string): string {
  const meta = (LANGUAGE_META as Record<string, { nativeName?: string }>)[code];
  return meta?.nativeName ? `${meta.nativeName} (${code})` : code;
}

// ============================================================
// DEFAULTS
// 默认值
// ============================================================

export const DEFAULT_LANGUAGE: AppLanguage = "zh-hant";
export const FALLBACK_LANGUAGE: AppLanguage = "en";

const ALL_APP_CANONICAL = new Set<string>(Object.values(APP_LANGUAGES));

/**
 * Normalize an app locale code to its canonical form.
 * Handles case-insensitive matching against canonical codes.
 * Returns null for unknown codes.
 * 将 app locale 代码规范化为其规范形式。
 * 对规范代码进行大小写不敏感的匹配。
 * 对未知代码返回 null。
 */
export function normalizeLanguage(code: string): Language | null {
  const lower = code.toLowerCase();
  if (ALL_APP_CANONICAL.has(lower)) return lower as Language;

  return null;
}

/**
 * Normalize public authored-content language input to a canonical Rezics slug.
 * Detector codes and historical aliases are intentionally rejected here.
 */
export function normalizeContentLanguage(code: string): ContentLanguage | null {
  return CONTENT_SLUG_TO_CANONICAL.get(code.toLowerCase()) ?? null;
}

export function contentLanguageMeta(
  language: string,
): (typeof REZICS_LANGUAGE_REGISTRY)[number] | null {
  const slug = normalizeContentLanguage(language);
  return slug ? (CONTENT_BY_SLUG.get(slug) ?? null) : null;
}

export function francMinLanguageToContentLanguage(
  francMinCode: string,
  options: {
    text?: string;
    fallbackChineseLanguage?: string | null;
  } = {},
): ContentLanguage | null {
  const code = francMinCode.toLowerCase();
  if (code !== "cmn") return FRANC_MIN_TO_CONTENT_SLUG.get(code) ?? null;

  const script = detectChineseScript(options.text ?? "");
  if (script) return script;
  const fallback = options.fallbackChineseLanguage
    ? normalizeContentLanguage(options.fallbackChineseLanguage)
    : null;
  if (fallback === "zh-hant" || fallback === "zh-hans") return fallback;
  return "zh-hans";
}

function detectChineseScript(text: string): "zh-hant" | "zh-hans" | null {
  let hant = 0;
  let hans = 0;
  for (const char of text) {
    if (TRADITIONAL_CHINESE_HINTS.has(char)) hant += 1;
    if (SIMPLIFIED_CHINESE_HINTS.has(char)) hans += 1;
  }
  if (hant === 0 && hans === 0) return null;
  return hant >= hans ? "zh-hant" : "zh-hans";
}

const TRADITIONAL_CHINESE_HINTS = new Set(
  "與為個們來時會說這還對開關學國語體書長門見後風東萬無點電車貓鳥魚馬龍雲臺灣廣義氣樂愛聽讀寫買賣選發現實際應該問題",
);

const SIMPLIFIED_CHINESE_HINTS = new Set(
  "与为个们来时会说这还对开关学国语体书长门见后风东万无点电车猫鸟鱼马龙云台湾广义气乐爱听读写买卖选发现实际应该问题",
);
