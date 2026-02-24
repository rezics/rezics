import {useEffect} from 'react';
import i18n from 'i18next';

export function PersistentSettingsLoader() {
  useEffect(() => {
    const lang = localStorage.getItem('lang');
    if (lang) {
      i18n.changeLanguage(lang);
    }
  }, []);

  return null;
}
