import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/**
 * 在应用启动时从 localStorage 中读取设置并初始化。
 */
export function PersistentSettingsLoader() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const lang = localStorage.getItem("lang");
    if (lang) {
      i18n.changeLanguage(lang);
    }
  }, []);

  return null; // 不渲染任何内容
}
