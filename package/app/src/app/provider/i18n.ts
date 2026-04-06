import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import deDE from "@/locale/de-DE.ts";
import enUS from "@/locale/en-US.ts";
import jaJP from "@/locale/ja-JP.ts";
import zhSC from "@/locale/zh-SC.ts";
import zhTC from "@/locale/zh-TC.ts";

export function initI18n() {
  i18n
    .use(initReactI18next) // passes i18n down to react-i18next
    .init({
      // the translations
      // (tip move them in a JSON file and import them,
      // or even better, manage them via a UI: https://react.i18next.com/guides/multiple-translation-files#manage-your-translations-with-a-management-gui)
      resources: {
        "en-US": { translation: enUS },
        "zh-SC": { translation: zhSC },
        "de-DE": { translation: deDE },
        "ja-JP": { translation: jaJP },
        "zh-TC": { translation: zhTC },
      },
      lng: "zh-SC", // if you're using a language detector, do not define the lng option
      fallbackLng: "en-US",
      interpolation: {
        escapeValue: false, // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
      },
    });
}
