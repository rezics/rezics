import { beforeEach, describe, expect, test } from "bun:test";
import { DEFAULT_LANGUAGE, type Language } from "@rezics/contract";
import {
  getLocale,
  initI18n,
  type RegisteredRuntime,
  registerParaglideRuntime,
  setLocale,
  subscribeLocale,
} from "./react";

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

function createRuntime(initialLocale: Language = DEFAULT_LANGUAGE) {
  let runtimeLocale = initialLocale;
  const setCalls: Array<{
    locale: Language;
    options: { reload?: boolean } | undefined;
  }> = [];

  const originalGetLocale = () => runtimeLocale;
  const originalSetLocale = (
    locale: Language,
    options?: { reload?: boolean },
  ) => {
    runtimeLocale = locale;
    setCalls.push({ locale, options });
  };

  const runtime: RegisteredRuntime = {
    getLocale: originalGetLocale,
    setLocale: originalSetLocale,
    overwriteGetLocale: (fn) => {
      runtime.getLocale = fn;
    },
    overwriteSetLocale: (fn) => {
      runtime.setLocale = fn;
    },
  };

  return {
    runtime,
    setCalls,
    get runtimeLocale() {
      return runtimeLocale;
    },
  };
}

beforeEach(() => {
  storage.clear();
  initI18n({ locale: DEFAULT_LANGUAGE });
});

describe("React i18n locale store", () => {
  test("sets, gets, subscribes, and persists canonical locales", () => {
    let calls = 0;
    const unsubscribe = subscribeLocale(() => {
      calls += 1;
    });

    setLocale("EN");

    expect(getLocale()).toBe("en");
    expect(localStorage.getItem("lang")).toBe("en");
    expect(calls).toBe(1);

    setLocale("en");

    expect(calls).toBe(1);

    unsubscribe();
    setLocale("ja");

    expect(calls).toBe(1);
  });

  test("rejects invalid locales without changing the active locale", () => {
    setLocale("ko");

    expect(() => setLocale("ko-KR")).toThrow(RangeError);
    expect(getLocale()).toBe("ko");
  });

  test("initializes from the persisted lang localStorage value", () => {
    localStorage.setItem("lang", "JA");

    initI18n();

    expect(getLocale()).toBe("ja");
  });

  test("falls back to the default language for invalid persisted values", () => {
    localStorage.setItem("lang", "en-US");

    initI18n();

    expect(getLocale()).toBe(DEFAULT_LANGUAGE);
  });
});

describe("registerParaglideRuntime", () => {
  test("fans adapter locale changes out to product and UI runtimes", () => {
    const product = createRuntime();
    const ui = createRuntime();
    const unregisterProduct = registerParaglideRuntime(product.runtime);
    const unregisterUi = registerParaglideRuntime(ui.runtime);

    setLocale("ja");

    expect(product.runtimeLocale).toBe("ja");
    expect(ui.runtimeLocale).toBe("ja");
    expect(product.setCalls.at(-1)).toEqual({
      locale: "ja",
      options: { reload: false },
    });
    expect(ui.setCalls.at(-1)).toEqual({
      locale: "ja",
      options: { reload: false },
    });

    unregisterProduct();
    unregisterUi();
  });

  test("delegates direct runtime setter calls to the shared adapter once", () => {
    const runtime = createRuntime();
    const unregister = registerParaglideRuntime(runtime.runtime);
    let calls = 0;
    const unsubscribe = subscribeLocale(() => {
      calls += 1;
    });

    runtime.runtime.setLocale("de");

    expect(getLocale()).toBe("de");
    expect(runtime.runtimeLocale).toBe("de");
    expect(calls).toBe(1);

    unsubscribe();
    unregister();
  });
});
