import i18n from "i18next";

import de from "@/locale/de.ts";
import en from "@/locale/en.ts";
import ja from "@/locale/ja.ts";
import zhHans from "@/locale/zh-hans.ts";
import zhHant from "@/locale/zh-hant.ts";

export function initI18n() {
  i18n.init({
    resources: {
      en: { translation: en },
      "zh-hant": { translation: zhHant },
      "zh-hans": { translation: zhHans },
      de: { translation: de },
      ja: { translation: ja },
    },
    lng: "zh-hant",
    fallbackLng: "en",
    lowerCaseLng: true,
    interpolation: {
      escapeValue: false,
    },
  });
}
