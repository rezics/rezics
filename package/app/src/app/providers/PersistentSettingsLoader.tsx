import i18n from "i18next";
import { useEffect } from "react";

export function PersistentSettingsLoader() {
  useEffect(() => {
    const lang = localStorage.getItem("lang");
    if (lang) {
      i18n.changeLanguage(lang);
    }
  }, []);

  return null;
}
