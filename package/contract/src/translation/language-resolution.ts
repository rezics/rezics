import { t } from "elysia";
import { contentDocSchema } from "../content/doc-v1";
import { contentTranslationDTOSchema } from "../content/translation";
import { languageSchema } from "../language";
import {
  DEFAULT_LANGUAGE,
  type Language,
  normalizeLanguage,
} from "../language-core";
import { listLanguageModeSchema } from "../list-query-base";
import {
  unitSupportLanguageDTOSchema,
  unitTranslationDTOSchema,
} from "../unit/unit";

export {
  type ListLanguageMode,
  listLanguageModeSchema,
} from "../list-query-base";

export const languageResolutionInputSchema = t.Object({
  explicitLanguage: t.Optional(languageSchema),
  preferredLanguages: t.Optional(t.Array(languageSchema)),
  appLocale: t.Optional(languageSchema),
});

export type LanguageResolutionInput =
  (typeof languageResolutionInputSchema)["static"];

export type SupportLanguageLike = {
  language: string | Language;
  isPrimary?: boolean | null;
  sortOrder?: number | null;
};

export const readLanguageQuerySchema = t.Object({
  languages: t.Optional(t.String()),
  appLocale: t.Optional(languageSchema),
  languageMode: t.Optional(listLanguageModeSchema),
});

export type ReadLanguageQuery = (typeof readLanguageQuerySchema)["static"];

/**
 * Return primary support languages in stable support-language sort order.
 * 以稳定的支持语言排序返回主要支持语言。
 */
export function primaryLanguages(
  supportLanguages: readonly SupportLanguageLike[] = [],
): Language[] {
  return uniqueLanguages(
    supportLanguages
      .filter((item) => item.isPrimary)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((item) => item.language),
  );
}

/**
 * Return the first primary support language, then the first supported language.
 * 返回第一个主要支持语言，否则返回第一个受支持语言。
 */
export function defaultSupportLanguage(
  supportLanguages: readonly SupportLanguageLike[] | null | undefined = [],
): Language | null {
  const ordered = [...(supportLanguages ?? [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
  return (
    primaryLanguages(ordered)[0] ??
    uniqueLanguages(ordered.map((item) => item.language))[0] ??
    null
  );
}

/**
 * Build the ordered candidate list for localized reads.
 * 为本地化读取构建有序的候选语言列表。
 *
 * App locale is the user's local runtime choice and outranks account-level
 * content preferences. Support languages and the platform fallback fill in only
 * after request/app/user candidates.
 * appLocale 是用户本地运行时的选择，优先级高于账户级别的内容偏好。支持语言和
 * 平台兜底语言仅在请求/应用/用户候选之后才参与补位。
 */
export function readLanguageCandidates(input: {
  explicitLanguage?: string | null;
  preferredLanguages?: readonly (string | null | undefined)[] | null;
  languages?: readonly (string | null | undefined)[] | null;
  appLocale?: string | null;
  supportLanguages?: readonly SupportLanguageLike[] | null;
  fallbackLanguage?: string | null;
}): Language[] {
  const supportLanguages = input.supportLanguages ?? [];
  const primary = supportLanguages
    .filter((item) => item.isPrimary)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const remaining = supportLanguages
    .filter((item) => !item.isPrimary)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return uniqueLanguages([
    input.explicitLanguage,
    input.appLocale,
    ...(input.languages ?? []),
    ...(input.preferredLanguages ?? []),
    ...primary.map((item) => item.language),
    ...remaining.map((item) => item.language),
    input.fallbackLanguage ?? DEFAULT_LANGUAGE,
  ]);
}

/**
 * Build the ordered candidate list for a new localized write.
 * 为新的本地化写入构建有序的候选语言列表。
 *
 * Existing content updates should pass an explicit language instead of using
 * this as fallback resolution; create surfaces use it to seed the first draft.
 * 更新已有内容时应传入明确的语言，而不是依赖此处的兜底解析；创建场景用它来初始化
 * 首个草稿。
 */
export function authoringLanguageCandidates(input: {
  explicitLanguage?: string | null;
  preferredLanguages?: readonly (string | null | undefined)[] | null;
  appLocale?: string | null;
  fallbackLanguage?: string | null;
}): Language[] {
  return uniqueLanguages([
    input.explicitLanguage,
    input.preferredLanguages?.[0],
    input.appLocale,
    input.fallbackLanguage ?? DEFAULT_LANGUAGE,
  ]);
}

export function resolveAuthoringLanguage(
  input: Parameters<typeof authoringLanguageCandidates>[0],
): Language {
  return authoringLanguageCandidates(input)[0] ?? DEFAULT_LANGUAGE;
}

/**
 * Resolve one language for a read response from candidate order and supported
 * languages. Missing rows/fields in the resolved language intentionally remain
 * missing; availability is the supported-language set, not translation
 * completeness.
 * 根据候选顺序和受支持语言为读取响应解析出单个语言。已解析语言中缺失的行/字段
 * 会被有意保留为缺失；可用性由受支持语言集合决定，而非翻译的完整程度。
 */
export function resolveReadLanguage(input: {
  explicitLanguage?: string | null;
  preferredLanguages?: readonly (string | null | undefined)[] | null;
  languages?: readonly (string | null | undefined)[] | null;
  appLocale?: string | null;
  supportLanguages?: readonly SupportLanguageLike[] | null;
  availableLanguages?: readonly (string | null | undefined)[] | null;
  fallbackLanguage?: string | null;
}): Language | null {
  const available = uniqueLanguages(
    input.supportLanguages?.map((item) => item.language) ??
      input.availableLanguages ??
      [],
  );
  if (available.length === 0) return null;
  for (const language of readLanguageCandidates(input)) {
    if (available.includes(language)) return language;
  }
  return available[0] ?? null;
}

export function parseReadLanguages(
  raw: string | readonly string[] | null | undefined,
): Language[] {
  if (typeof raw === "string") return uniqueLanguages(raw.split(","));
  return uniqueLanguages(raw ?? []);
}

function uniqueLanguages(
  languages: readonly (string | null | undefined)[],
): Language[] {
  return [
    ...new Set(
      languages
        .map((language) => language?.trim())
        .map((language) => (language ? normalizeLanguage(language) : null))
        .filter((language): language is Language => !!language),
    ),
  ];
}

export const unitLanguageAvailabilitySchema = t.Object({
  unitId: t.String(),
  supportLanguages: t.Array(unitSupportLanguageDTOSchema),
  unitTranslationLanguages: t.Array(languageSchema),
  contentTranslationLanguages: t.Array(languageSchema),
});

export type UnitLanguageAvailability =
  (typeof unitLanguageAvailabilitySchema)["static"];

export const unitLanguageAvailabilityResponseSchema =
  unitLanguageAvailabilitySchema;

export type UnitLanguageAvailabilityResponse =
  (typeof unitLanguageAvailabilityResponseSchema)["static"];

export const unitLanguageContentQuerySchema = t.Object({
  explicitLanguage: t.Optional(languageSchema),
  languages: t.Optional(t.String()),
  appLocale: t.Optional(languageSchema),
});

export type UnitLanguageContentQuery =
  (typeof unitLanguageContentQuerySchema)["static"];

export const unitLanguageContentResponseSchema = t.Object({
  unitId: t.String(),
  requestedLanguage: t.Optional(languageSchema),
  resolvedLanguage: t.Optional(t.Nullable(languageSchema)),
  supportLanguages: t.Array(unitSupportLanguageDTOSchema),
  unitTranslation: t.Optional(t.Nullable(unitTranslationDTOSchema)),
  contentTranslation: t.Optional(t.Nullable(contentTranslationDTOSchema)),
  title: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(contentDocSchema)),
  content: t.Optional(t.Nullable(t.Any())),
});

export type UnitLanguageContentResponse =
  (typeof unitLanguageContentResponseSchema)["static"];
