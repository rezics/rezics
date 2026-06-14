import {
  type ContentLanguage,
  francMinLanguageToContentLanguage,
  normalizeContentLanguage,
  REZICS_LANGUAGE_REGISTRY,
} from "@rezics/contract";
import { francAll } from "franc-min";

const MIN_DETECTABLE_TEXT_LENGTH = 20;
const FRANC_MIN_CODES = [
  ...new Set(REZICS_LANGUAGE_REGISTRY.map((entry) => entry.francMin)),
];

export type ContentLanguageDetection = {
  language: ContentLanguage;
  confidence: number;
  source: "franc-min";
};

export function detectContentLanguage(
  text: string,
  options: {
    fallbackLanguage?: string | null;
  } = {},
): ContentLanguageDetection | null {
  const normalized = normalizeDetectableText(text);
  if (normalized.length < MIN_DETECTABLE_TEXT_LENGTH) return null;

  const [best] = francAll(normalized, {
    only: FRANC_MIN_CODES,
    minLength: MIN_DETECTABLE_TEXT_LENGTH,
  });
  if (!best) return null;
  const [francCode, confidence] = best;
  const fallback = normalizeContentLanguage(options.fallbackLanguage ?? "");
  const language = francMinLanguageToContentLanguage(francCode, {
    text: normalized,
    fallbackChineseLanguage: fallback,
  });
  if (!language) return null;

  return { language, confidence, source: "franc-min" };
}

function normalizeDetectableText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
