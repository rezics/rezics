import { createI18nRuntime } from "@rezics/i18n/runtime";
import { registerUiLocale } from "@rezics/ui/i18n";

const runtime = createI18nRuntime();

export const i18nReady = runtime.ready.then(async () => {
  await registerUiLocale(runtime.i18n, runtime.i18n.language);
  runtime.i18n.on("languageChanged", (lng) => {
    void registerUiLocale(runtime.i18n, lng);
  });
  return runtime;
});

export function initI18n(): Promise<unknown> {
  return i18nReady;
}
