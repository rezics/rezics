import i18n from "i18next";

import deDE from "@/locale/de-DE.ts";
import enUS from "@/locale/en-US.ts";
import jaJP from "@/locale/ja-JP.ts";
import zhSC from "@/locale/zh-SC.ts";
import zhTW from "@/locale/zh-TC.ts";

export function initI18n() {
  i18n.init({
    resources: {
      "en-US": { translation: enUS },
      "zh-SC": { translation: zhSC },
      "de-DE": { translation: deDE },
      "ja-JP": { translation: jaJP },
      "zh-TC": { translation: zhTW },
    },
    lng: "zh-SC",
    fallbackLng: "en-US",
    interpolation: {
      escapeValue: false,
    },
  });
}
