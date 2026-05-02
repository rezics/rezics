import type { Decorator } from "@storybook/react-vite";
import i18n, { type Resource } from "i18next";
import { useEffect } from "react";
import { I18nextProvider, initReactI18next } from "react-i18next";

export interface LocaleOption {
  value: string;
  title: string;
}

export interface LocaleGlobalTypesOptions {
  defaultLanguage: string;
  locales: ReadonlyArray<LocaleOption>;
}

export function createLocaleGlobalTypes(options: LocaleGlobalTypesOptions) {
  return {
    locale: {
      name: "Locale",
      description: "i18n language",
      defaultValue: options.defaultLanguage,
      toolbar: {
        icon: "globe",
        items: options.locales.map((l) => ({
          value: l.value,
          title: l.title,
        })),
        dynamicTitle: true,
      },
    },
  } as const;
}

export interface WithI18nOptions {
  defaultLanguage?: string;
  fallbackLng?: string;
  defaultNS?: string;
}

export function withI18n(
  resources: Resource,
  options: WithI18nOptions = {},
): Decorator {
  const {
    defaultLanguage = "en",
    fallbackLng = "en",
    defaultNS = "translation",
  } = options;

  const instance = i18n.createInstance();
  void instance.use(initReactI18next).init({
    resources,
    lng: defaultLanguage,
    fallbackLng,
    defaultNS,
    lowerCaseLng: true,
    interpolation: { escapeValue: false },
  });

  return (Story, context) => {
    const locale = (context.globals.locale ?? defaultLanguage) as string;
    const normalized = locale.toLowerCase();

    useEffect(() => {
      if (instance.language !== normalized) {
        void instance.changeLanguage(normalized);
      }
    }, [normalized]);

    return (
      <I18nextProvider i18n={instance}>
        <Story />
      </I18nextProvider>
    );
  };
}
