import {useEffect} from 'react';
import i18n from 'i18next';

function initI18nStorage() {
  const lang = localStorage.getItem('lang');
  if (lang) {
    i18n.changeLanguage(lang);
  }
}

export function useAppInit() {
  useEffect(() => {
    initI18nStorage();
  }, []);
}
