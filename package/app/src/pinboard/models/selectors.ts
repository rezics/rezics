/**
 * Pure selectors for pinboard editor drafts. No React imports.
 */

import type {
  PinboardEditorDraft,
  PinboardEditorTranslationDraft,
} from "./types";

export function emptyTranslationDraft(
  language: string,
): PinboardEditorTranslationDraft {
  return {
    language,
    title: "",
    subtitle: "",
    summary: "",
    description: "",
    body: "",
  };
}

export function findTranslationDraft(
  draft: PinboardEditorDraft,
  language: string,
): PinboardEditorTranslationDraft | undefined {
  return draft.translations.find((t) => t.language === language);
}

export function hasLanguage(
  draft: PinboardEditorDraft,
  language: string,
): boolean {
  return draft.translations.some((t) => t.language === language);
}

export function isDefaultLanguage(
  draft: PinboardEditorDraft,
  language: string,
): boolean {
  return draft.defaultLanguage === language;
}

/**
 * A translation draft is "valid" when it has at least a title — other
 * fields are optional. The dialog enforces this before submit.
 */
export function isTranslationValid(
  draft: PinboardEditorTranslationDraft,
): boolean {
  return draft.title.trim().length > 0;
}

export function isDraftValid(draft: PinboardEditorDraft): boolean {
  if (draft.translations.length === 0) return false;
  const def = findTranslationDraft(draft, draft.defaultLanguage);
  if (!def || !isTranslationValid(def)) return false;
  return draft.translations.every(isTranslationValid);
}
