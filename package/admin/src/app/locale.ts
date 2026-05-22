import {
  DEFAULT_LANGUAGE,
  normalizeLanguage,
  type Language,
} from "@rezics/contract";
import { notifyLocaleChanged } from "@rezics/i18n/react";
import { setLocale as setProductLocale } from "@rezics/i18n/runtime";
import { setLocale as setUiLocale } from "@rezics/ui/i18n/runtime";

export function getStoredRezicsLocale(): Language {
  if (typeof localStorage === "undefined") return DEFAULT_LANGUAGE;

  const stored = localStorage.getItem("lang");
  return stored
    ? (normalizeLanguage(stored) ?? DEFAULT_LANGUAGE)
    : DEFAULT_LANGUAGE;
}

export function setRezicsLocale(locale: Language): void {
  setProductLocale(locale, { reload: false });
  setUiLocale(locale, { reload: false });
  localStorage.setItem("lang", locale);
  notifyLocaleChanged();
}

export function initRezicsLocale(): void {
  setRezicsLocale(getStoredRezicsLocale());
}
