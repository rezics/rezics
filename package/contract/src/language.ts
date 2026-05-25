import { t } from "elysia";
export {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  LANGUAGE_META,
} from "./language-core";
export {
  LANGUAGES,
  type Language,
  normalizeLanguage,
} from "./language-core";

export const languageSchema = t.Union([
  t.Literal("zh-hant"),
  t.Literal("zh-hans"),
  t.Literal("en"),
  t.Literal("ja"),
  t.Literal("de"),
  t.Literal("ko"),
]);
