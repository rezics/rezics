"use client";

import { useSyncExternalStore } from "react";
import type en from "./languages/en";

type Messages = typeof en;

const languages: Record<string, () => Promise<{ default: Messages }>> = {
  en: () => import("./languages/en"),
  "zh-hans": () => import("./languages/zh-hans"),
};

let current: Messages | null = null;
let currentLocale = "en";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Messages {
  if (!current) {
    // Synchronously load English as default
    // 同步加载英文作为默认语言
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    current = require("./languages/en").default;
  }
  return current!;
}

export function setLocale(locale: string) {
  const loader = languages[locale];
  if (!loader) return;
  currentLocale = locale;
  loader().then((mod) => {
    current = mod.default;
    listeners.forEach((l) => l());
  });
}

export function getLocale() {
  return currentLocale;
}

export function useT(): [Messages] {
  const messages = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return [messages];
}

export function LocaleSync() {
  // Sync locale from cookie/localStorage on mount
  // 挂载时从 cookie/localStorage 同步语言设置
  return null;
}
