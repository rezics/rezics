import { describe, expect, test } from "bun:test";
import * as productMessages from "@rezics/i18n/messages";
import { getLocale as getProductLocale } from "@rezics/i18n/runtime";
import * as uiMessages from "@rezics/ui/i18n/messages";
import { getLocale as getUiLocale } from "@rezics/ui/i18n/runtime";
import { setRezicsLocale } from "./locale";

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

describe("setRezicsLocale", () => {
  test("synchronizes product and UI Paraglide runtimes", () => {
    setRezicsLocale("en");

    expect(getProductLocale()).toBe("en");
    expect(getUiLocale()).toBe("en");
    expect(productMessages.title()).toBe("REZICS");
    expect(uiMessages.ui_password_label()).toBe("Password");

    setRezicsLocale("zh-hant");

    expect(getProductLocale()).toBe("zh-hant");
    expect(getUiLocale()).toBe("zh-hant");
    expect(uiMessages.ui_password_label()).toBe("密碼");
  });
});
