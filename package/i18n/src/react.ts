import { useSyncExternalStore } from "react";
import { getLocale } from "./paraglide/runtime.js";

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
