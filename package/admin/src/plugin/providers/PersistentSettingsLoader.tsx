import { useEffect } from 'react';
import i18n from 'i18next';

/**
 * 在应用启动时从 localStorage 中读取设置并初始化。
 */
export function PersistentSettingsLoader() {
  useEffect(() => {
    const lang = localStorage.getItem('lang');
    if (lang) {
      i18n.changeLanguage(lang);
    }
  }, []);

  return null; // 不渲染任何内容
}
