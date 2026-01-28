import i18n from 'i18next';

import deDE from '@/locale/de-DE.ts';
import enUS from '@/locale/en-US.ts';
import jaJP from '@/locale/ja-JP.ts';
import zhCN from '@/locale/zh-CN.ts';
import zhTW from '@/locale/zh-TW.ts';

export function initI18n() {
  i18n.init({
    resources: {
      'en-US': {translation: enUS},
      'zh-CN': {translation: zhCN},
      'de-DE': {translation: deDE},
      'ja-JP': {translation: jaJP},
      'zh-TW': {translation: zhTW},
    },
    lng: 'zh-CN',
    fallbackLng: 'en-US',
    interpolation: {
      escapeValue: false,
    },
  });
}
