import { describe, expect, test } from "bun:test";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import { getLocale as getProductLocale } from "@rezics/i18n/runtime";
import { getLocale as getUiLocale } from "@rezics/ui/i18n/runtime";
import { getStoredRezicsLocale, setRezicsLocale } from "./locale";

const storage = new Map<string, string>();

globalThis.localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => {
    storage.clear();
  },
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
  get length() {
    return storage.size;
  },
} as Storage;

describe("admin locale setup", () => {
  test("supports Korean across product and UI Paraglide runtimes", () => {
    setRezicsLocale("ko");

    expect(getProductLocale()).toBe("ko");
    expect(getUiLocale()).toBe("ko");
  });

  test("normalizes invalid stored locale to the default language", () => {
    localStorage.setItem("lang", "ko-KR");

    expect(getStoredRezicsLocale()).toBe(DEFAULT_LANGUAGE);
  });
});
