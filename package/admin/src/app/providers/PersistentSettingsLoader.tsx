import { useEffect } from "react";
import { initI18n } from "./i18n";

export function PersistentSettingsLoader() {
  useEffect(() => {
    initI18n();
  }, []);

  return null;
}
