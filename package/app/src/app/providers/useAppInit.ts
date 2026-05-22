import { useInfraBootstrap } from "@rezics/api/infra/bootstrap";
import { useEffect } from "react";
import { initRezicsLocale } from "@/app/locale";

function initI18nStorage() {
  initRezicsLocale();
}

export function useAppInit() {
  useEffect(() => {
    initI18nStorage();
  }, []);

  useInfraBootstrap();
}
