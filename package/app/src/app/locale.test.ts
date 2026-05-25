import { describe, expect, test } from "bun:test";
import { title } from "@rezics/i18n/messages";
import { setLocale, subscribeLocale } from "@rezics/i18n/react";
import { getLocale as getProductLocale } from "@rezics/i18n/runtime";
import { ui_password_label } from "@rezics/ui/i18n/messages";
import { getLocale as getUiLocale } from "@rezics/ui/i18n/runtime";
import { initI18n } from "./providers/i18n";

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

describe("app i18n bootstrap", () => {
  test("synchronizes product and UI Paraglide runtimes", () => {
    initI18n();
    setLocale("en");

    expect(getProductLocale()).toBe("en");
    expect(getUiLocale()).toBe("en");
    expect(String(title())).toBe("REZICS");
    expect(String(ui_password_label())).toBe("Password");

    setLocale("zh-hant");

    expect(getProductLocale()).toBe("zh-hant");
    expect(getUiLocale()).toBe("zh-hant");
    expect(String(ui_password_label())).toBe("密碼");

    setLocale("ko");

    expect(getProductLocale()).toBe("ko");
    expect(getUiLocale()).toBe("ko");
    expect(String(ui_password_label())).toBe("Password");
  });

  test("notifies React locale subscribers", () => {
    let calls = 0;
    const unsubscribe = subscribeLocale(() => {
      calls += 1;
    });

    initI18n();
    setLocale("ja");

    unsubscribe();
    expect(calls).toBe(1);
  });
});
