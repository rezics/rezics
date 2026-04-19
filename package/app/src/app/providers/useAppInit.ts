import { useInfraBootstrap } from "@rezics/api/infra/bootstrap";
import i18n from "i18next";
import { useEffect } from "react";

function initI18nStorage() {
  const lang = localStorage.getItem("lang");
  if (lang) {
    i18n.changeLanguage(lang);
  }
}

export function useAppInit() {
  useEffect(() => {
    initI18nStorage();
  }, []);

  useInfraBootstrap();
}
