import { useEffect } from "react";
import { initI18n } from "./i18n";

function initI18nStorage() {
  initI18n();
}

export function useAppInit() {
  useEffect(() => {
    initI18nStorage();
  }, []);
}
