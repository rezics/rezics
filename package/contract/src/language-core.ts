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
  slug: string;
  englishName: string;
  nativeName: string;
  francMin: string;
  iso6391?: string;
  script?: "Hans" | "Hant";
  direction?: "ltr" | "rtl";
  appLocale?: boolean;
  contentLanguage: true;
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
    francMin: "cmn",
    iso6391: "zh",
    script: "Hant",
    appLocale: true,
    contentLanguage: true,
  },
  {
    slug: "zh-hans",
    englishName: "Simplified Chinese",
    nativeName: "简体中文",
    francMin: "cmn",
    iso6391: "zh",
    script: "Hans",
    appLocale: true,
    contentLanguage: true,
  },
  {
    slug: "en",
    englishName: "English",
    nativeName: "English",
    francMin: "eng",
    iso6391: "en",
    appLocale: true,
    contentLanguage: true,
  },
  {
    slug: "ja",
    englishName: "Japanese",
    nativeName: "日本語",
    francMin: "jpn",
    iso6391: "ja",
    appLocale: true,
    contentLanguage: true,
  },
  {
    slug: "de",
    englishName: "German",
    nativeName: "Deutsch",
    francMin: "deu",
    iso6391: "de",
    appLocale: true,
    contentLanguage: true,
  },
  {
    slug: "ko",
    englishName: "Korean",
    nativeName: "한국어",
    francMin: "kor",
    iso6391: "ko",
    appLocale: true,
    contentLanguage: true,
  },
  {
    slug: "amh",
    englishName: "Amharic",
    nativeName: "Amharic",
    francMin: "amh",
    contentLanguage: true,
  },
  {
    slug: "arb",
    englishName: "Standard Arabic",
    nativeName: "Standard Arabic",
    francMin: "arb",
    direction: "rtl",
    contentLanguage: true,
  },
  {
    slug: "azj",
    englishName: "North Azerbaijani",
    nativeName: "North Azerbaijani",
    francMin: "azj",
    contentLanguage: true,
  },
  {
    slug: "bel",
    englishName: "Belarusian",
    nativeName: "Belarusian",
    francMin: "bel",
    contentLanguage: true,
  },
  {
    slug: "ben",
    englishName: "Bengali",
    nativeName: "Bengali",
    francMin: "ben",
    iso6391: "bn",
    contentLanguage: true,
  },
  {
    slug: "bho",
    englishName: "Bhojpuri",
    nativeName: "Bhojpuri",
    francMin: "bho",
    contentLanguage: true,
  },
  {
    slug: "bos",
    englishName: "Bosnian",
    nativeName: "Bosnian",
    francMin: "bos",
    iso6391: "bs",
    contentLanguage: true,
  },
  {
    slug: "bul",
    englishName: "Bulgarian",
    nativeName: "Bulgarian",
    francMin: "bul",
    iso6391: "bg",
    contentLanguage: true,
  },
  {
    slug: "ceb",
    englishName: "Cebuano",
    nativeName: "Cebuano",
    francMin: "ceb",
    contentLanguage: true,
  },
  {
    slug: "ces",
    englishName: "Czech",
    nativeName: "Czech",
    francMin: "ces",
    iso6391: "cs",
    contentLanguage: true,
  },
  {
    slug: "ckb",
    englishName: "Central Kurdish",
    nativeName: "Central Kurdish",
    francMin: "ckb",
    direction: "rtl",
    contentLanguage: true,
  },
  {
    slug: "ell",
    englishName: "Modern Greek",
    nativeName: "Modern Greek",
    francMin: "ell",
    iso6391: "el",
    contentLanguage: true,
  },
  {
    slug: "fra",
    englishName: "French",
    nativeName: "French",
    francMin: "fra",
    iso6391: "fr",
    contentLanguage: true,
  },
  {
    slug: "fuv",
    englishName: "Nigerian Fulfulde",
    nativeName: "Nigerian Fulfulde",
    francMin: "fuv",
    contentLanguage: true,
  },
  {
    slug: "guj",
    englishName: "Gujarati",
    nativeName: "Gujarati",
    francMin: "guj",
    iso6391: "gu",
    contentLanguage: true,
  },
  {
    slug: "hau",
    englishName: "Hausa",
    nativeName: "Hausa",
    francMin: "hau",
    iso6391: "ha",
    contentLanguage: true,
  },
  {
    slug: "hin",
    englishName: "Hindi",
    nativeName: "Hindi",
    francMin: "hin",
    iso6391: "hi",
    contentLanguage: true,
  },
  {
    slug: "hms",
    englishName: "Southern Qiandong Miao",
    nativeName: "Southern Qiandong Miao",
    francMin: "hms",
    contentLanguage: true,
  },
  {
    slug: "hnj",
    englishName: "Hmong Njua",
    nativeName: "Hmong Njua",
    francMin: "hnj",
    contentLanguage: true,
  },
  {
    slug: "hrv",
    englishName: "Croatian",
    nativeName: "Croatian",
    francMin: "hrv",
    iso6391: "hr",
    contentLanguage: true,
  },
  {
    slug: "hun",
    englishName: "Hungarian",
    nativeName: "Hungarian",
    francMin: "hun",
    iso6391: "hu",
    contentLanguage: true,
  },
  {
    slug: "ibo",
    englishName: "Igbo",
    nativeName: "Igbo",
    francMin: "ibo",
    iso6391: "ig",
    contentLanguage: true,
  },
  {
    slug: "ilo",
    englishName: "Iloko",
    nativeName: "Iloko",
    francMin: "ilo",
    contentLanguage: true,
  },
  {
    slug: "ind",
    englishName: "Indonesian",
    nativeName: "Indonesian",
    francMin: "ind",
    iso6391: "id",
    contentLanguage: true,
  },
  {
    slug: "ita",
    englishName: "Italian",
    nativeName: "Italian",
    francMin: "ita",
    iso6391: "it",
    contentLanguage: true,
  },
  {
    slug: "jav",
    englishName: "Javanese",
    nativeName: "Javanese",
    francMin: "jav",
    iso6391: "jv",
    contentLanguage: true,
  },
  {
    slug: "kan",
    englishName: "Kannada",
    nativeName: "Kannada",
    francMin: "kan",
    iso6391: "kn",
    contentLanguage: true,
  },
  {
    slug: "kaz",
    englishName: "Kazakh",
    nativeName: "Kazakh",
    francMin: "kaz",
    iso6391: "kk",
    contentLanguage: true,
  },
  {
    slug: "kin",
    englishName: "Kinyarwanda",
    nativeName: "Kinyarwanda",
    francMin: "kin",
    iso6391: "rw",
    contentLanguage: true,
  },
  {
    slug: "koi",
    englishName: "Komi-Permyak",
    nativeName: "Komi-Permyak",
    francMin: "koi",
    contentLanguage: true,
  },
  {
    slug: "lin",
    englishName: "Lingala",
    nativeName: "Lingala",
    francMin: "lin",
    iso6391: "ln",
    contentLanguage: true,
  },
  {
    slug: "mad",
    englishName: "Madurese",
    nativeName: "Madurese",
    francMin: "mad",
    contentLanguage: true,
  },
  {
    slug: "mag",
    englishName: "Magahi",
    nativeName: "Magahi",
    francMin: "mag",
    contentLanguage: true,
  },
  {
    slug: "mai",
    englishName: "Maithili",
    nativeName: "Maithili",
    francMin: "mai",
    contentLanguage: true,
  },
  {
    slug: "mal",
    englishName: "Malayalam",
    nativeName: "Malayalam",
    francMin: "mal",
    iso6391: "ml",
    contentLanguage: true,
  },
  {
    slug: "mar",
    englishName: "Marathi",
    nativeName: "Marathi",
    francMin: "mar",
    iso6391: "mr",
    contentLanguage: true,
  },
  {
    slug: "mya",
    englishName: "Burmese",
    nativeName: "Burmese",
    francMin: "mya",
    iso6391: "my",
    contentLanguage: true,
  },
  {
    slug: "nld",
    englishName: "Dutch",
    nativeName: "Dutch",
    francMin: "nld",
    iso6391: "nl",
    contentLanguage: true,
  },
  {
    slug: "npi",
    englishName: "Nepali",
    nativeName: "Nepali",
    francMin: "npi",
    iso6391: "ne",
    contentLanguage: true,
  },
  {
    slug: "nya",
    englishName: "Nyanja",
    nativeName: "Nyanja",
    francMin: "nya",
    iso6391: "ny",
    contentLanguage: true,
  },
  {
    slug: "pan",
    englishName: "Panjabi",
    nativeName: "Panjabi",
    francMin: "pan",
    iso6391: "pa",
    contentLanguage: true,
  },
  {
    slug: "pbu",
    englishName: "Northern Pashto",
    nativeName: "Northern Pashto",
    francMin: "pbu",
    contentLanguage: true,
  },
  {
    slug: "pes",
    englishName: "Iranian Persian",
    nativeName: "Iranian Persian",
    francMin: "pes",
    iso6391: "fa",
    direction: "rtl",
    contentLanguage: true,
  },
  {
    slug: "plt",
    englishName: "Plateau Malagasy",
    nativeName: "Plateau Malagasy",
    francMin: "plt",
    contentLanguage: true,
  },
  {
    slug: "pol",
    englishName: "Polish",
    nativeName: "Polish",
    francMin: "pol",
    iso6391: "pl",
    contentLanguage: true,
  },
  {
    slug: "por",
    englishName: "Portuguese",
    nativeName: "Portuguese",
    francMin: "por",
    iso6391: "pt",
    contentLanguage: true,
  },
  {
    slug: "qug",
    englishName: "Chimborazo Highland Quichua",
    nativeName: "Chimborazo Highland Quichua",
    francMin: "qug",
    contentLanguage: true,
  },
  {
    slug: "ron",
    englishName: "Romanian",
    nativeName: "Romanian",
    francMin: "ron",
    iso6391: "ro",
    contentLanguage: true,
  },
  {
    slug: "run",
    englishName: "Rundi",
    nativeName: "Rundi",
    francMin: "run",
    iso6391: "rn",
    contentLanguage: true,
  },
  {
    slug: "rus",
    englishName: "Russian",
    nativeName: "Russian",
    francMin: "rus",
    iso6391: "ru",
    contentLanguage: true,
  },
  {
    slug: "sin",
    englishName: "Sinhala",
    nativeName: "Sinhala",
    francMin: "sin",
    iso6391: "si",
    contentLanguage: true,
  },
  {
    slug: "skr",
    englishName: "Saraiki",
    nativeName: "Saraiki",
    francMin: "skr",
    direction: "rtl",
    contentLanguage: true,
  },
  {
    slug: "som",
    englishName: "Somali",
    nativeName: "Somali",
    francMin: "som",
    iso6391: "so",
    contentLanguage: true,
  },
  {
    slug: "spa",
    englishName: "Spanish",
    nativeName: "Spanish",
    francMin: "spa",
    iso6391: "es",
    contentLanguage: true,
  },
  {
    slug: "srp",
    englishName: "Serbian",
    nativeName: "Serbian",
    francMin: "srp",
    iso6391: "sr",
    contentLanguage: true,
  },
  {
    slug: "sun",
    englishName: "Sundanese",
    nativeName: "Sundanese",
    francMin: "sun",
    iso6391: "su",
    contentLanguage: true,
  },
  {
    slug: "swe",
    englishName: "Swedish",
    nativeName: "Swedish",
    francMin: "swe",
    iso6391: "sv",
    contentLanguage: true,
  },
  {
    slug: "swh",
    englishName: "Swahili",
    nativeName: "Swahili",
    francMin: "swh",
    iso6391: "sw",
    contentLanguage: true,
  },
  {
    slug: "tam",
    englishName: "Tamil",
    nativeName: "Tamil",
    francMin: "tam",
    iso6391: "ta",
    contentLanguage: true,
  },
  {
    slug: "tel",
    englishName: "Telugu",
    nativeName: "Telugu",
    francMin: "tel",
    iso6391: "te",
    contentLanguage: true,
  },
  {
    slug: "tgl",
    englishName: "Tagalog",
    nativeName: "Tagalog",
    francMin: "tgl",
    iso6391: "tl",
    contentLanguage: true,
  },
  {
    slug: "tha",
    englishName: "Thai",
    nativeName: "Thai",
    francMin: "tha",
    iso6391: "th",
    contentLanguage: true,
  },
  {
    slug: "tur",
    englishName: "Turkish",
    nativeName: "Turkish",
    francMin: "tur",
    iso6391: "tr",
    contentLanguage: true,
  },
  {
    slug: "ukr",
    englishName: "Ukrainian",
    nativeName: "Ukrainian",
    francMin: "ukr",
    iso6391: "uk",
    contentLanguage: true,
  },
  {
    slug: "urd",
    englishName: "Urdu",
    nativeName: "Urdu",
    francMin: "urd",
    iso6391: "ur",
    direction: "rtl",
    contentLanguage: true,
  },
  {
    slug: "uzn",
    englishName: "Northern Uzbek",
    nativeName: "Northern Uzbek",
    francMin: "uzn",
    contentLanguage: true,
  },
  {
    slug: "vie",
    englishName: "Vietnamese",
    nativeName: "Vietnamese",
    francMin: "vie",
    iso6391: "vi",
    contentLanguage: true,
  },
  {
    slug: "yor",
    englishName: "Yoruba",
    nativeName: "Yoruba",
    francMin: "yor",
    iso6391: "yo",
    contentLanguage: true,
  },
  {
    slug: "zlm",
    englishName: "Malay",
    nativeName: "Malay",
    francMin: "zlm",
    iso6391: "ms",
    contentLanguage: true,
  },
  {
    slug: "zul",
    englishName: "Zulu",
    nativeName: "Zulu",
    francMin: "zul",
    iso6391: "zu",
    contentLanguage: true,
  },
  {
    slug: "zyb",
    englishName: "Yongbei Zhuang",
    nativeName: "Yongbei Zhuang",
    francMin: "zyb",
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

const CONTENT_ALIAS_TO_SLUG = new Map<string, ContentLanguage>();
for (const entry of REZICS_LANGUAGE_REGISTRY) {
  CONTENT_ALIAS_TO_SLUG.set(entry.slug.toLowerCase(), entry.slug);
  CONTENT_ALIAS_TO_SLUG.set(entry.francMin.toLowerCase(), entry.slug);
  if (entry.iso6391) {
    CONTENT_ALIAS_TO_SLUG.set(entry.iso6391.toLowerCase(), entry.slug);
  }
}

// ISO-639-3 `cmn` cannot distinguish Traditional/Simplified Chinese by itself.
CONTENT_ALIAS_TO_SLUG.set("cmn", "zh-hans");

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
 * Normalize authored content language identifiers to Rezics slugs. Accepts
 * Rezics slugs, known ISO-639-1 aliases, and franc-min ISO-639-3 codes.
 */
export function normalizeContentLanguage(code: string): ContentLanguage | null {
  return CONTENT_ALIAS_TO_SLUG.get(code.toLowerCase()) ?? null;
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
  if (code !== "cmn") return normalizeContentLanguage(code);

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
