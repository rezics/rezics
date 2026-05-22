import { useEffect } from "react";
import { initRezicsLocale } from "@/app/locale";

export function PersistentSettingsLoader() {
  useEffect(() => {
    initRezicsLocale();
  }, []);

  return null;
}
