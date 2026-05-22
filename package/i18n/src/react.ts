import { useSyncExternalStore } from "react";
import {
  type Locale,
  getLocale,
  setLocale as setProductLocale,
} from "./paraglide/runtime.js";
import { translate } from "./translate.ts";

const listeners = new Set<() => void>();

function emitLocaleChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyLocaleChanged(): void {
  emitLocaleChange();
}

export function useLocale(): string {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}

export function useTranslation() {
  const language = useLocale();

  return {
    t: translate,
    i18n: {
      language,
      resolvedLanguage: language,
      changeLanguage: (locale: string) => {
        setProductLocale(locale as Locale, { reload: false });
        emitLocaleChange();
      },
    },
  };
}
