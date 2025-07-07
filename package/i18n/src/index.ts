export type Locale = {
    [key: string]: string | Locale;
};

const splitter = "->" as const;
type Splitter = typeof splitter;

type Leaves<T> = T extends object
    ? {
          [K in keyof T]: `${Exclude<K, symbol>}${Leaves<T[K]> extends never ? "" : `${Splitter}${Leaves<T[K]>}`}`;
      }[keyof T]
    : never;

const match = <T extends string[]>(source: string, targets: T): T[number] | null => {
    const [language] = source.split("-");
    return targets.find((target) => target === source) ?? targets.find((target) => target === language) ?? null;
};
const arrest = <T>(arrestion: boolean, message: string, value: T): T => {
    if (arrestion) return value;
    throw new Error(message);
};

export const make = <K extends string, T extends Record<string, T[K]>>(main: K, locale: T) => {
    const locales = Object.keys(locale);
    const matched = match(navigator.language, locales);

    const get = (key: Leaves<T[K]>, id = matched): string => {
        const leaves = key.split(splitter) as string[];

        return leaves.reduce<string | Locale>(
            (acc, curr) => (acc as Locale)[curr] || arrest(id !== main, `Key not found: ${key}`, get(key, main)!),
            locale[id!]!,
        ) as string;
    };

    return {
        get,
    };
};
