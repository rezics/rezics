import type { Decorator } from "@storybook/react-vite";

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
  _resources: Record<string, unknown>,
  options: WithI18nOptions = {},
): Decorator {
  const { defaultLanguage = "en" } = options;

  return (Story, context) => {
    const locale = (context.globals.locale ?? defaultLanguage) as string;
    document.documentElement.lang = locale;
    return <Story />;
  };
}
