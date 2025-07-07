export type Leaf = string | ((...args: any[]) => string);
export type Locale = {
    [key: string]: Leaf | Locale;
};

const splitter = "->" as const;
type Splitter = typeof splitter;

type Path<T> = T extends object
    ? {
          [K in keyof T]: `${Exclude<K, symbol>}${Path<T[K]> extends never ? "" : `${Splitter}${Path<T[K]>}`}`;
      }[keyof T]
    : never;

type FromPath<T, P extends string> = P extends `${infer K}${Splitter}${infer R}`
    ? K extends keyof T
        ? FromPath<T[K], R>
        : never
    : P extends keyof T
      ? T[P]
      : never;

const match = <T extends string[]>(source: string, targets: T): T[number] | null => {
    const [language] = source.split("-");
    return targets.find((target) => target === source) ?? targets.find((target) => target === language) ?? null;
};

export const make = <T extends Record<string, T[K]>, K extends keyof T extends string ? keyof T : never>(
    main: K,
    locale: T,
) => {
    type ID = keyof T extends string ? keyof T : never;

    const locales = Object.keys(locale) as ID[];
    let matched: ID = match(navigator.language, locales) || (main as ID);

    const set = (id: ID) => {
        matched = id;
    };

    const get = <P extends Path<T[K]>>(key: P, id = matched): FromPath<T[K], P> => {
        const leaves = key.split(splitter) as string[];

        return leaves.reduce<Leaf | Locale>((acc, curr) => {
            try {
                return (acc as object)[curr as keyof typeof acc]!;
            } catch (e) {
                if (id !== main) {
                    console.warn(`'${key}' can not be found in locale '${id}', falling back to main '${main}'.`);
                    return get(key, main)!;
                } else {
                    throw new Error(`'${key}' can not be found in locale '${id}' and no fallback is available.`);
                }
            }
        }, locale[id!]!) as any;
    };

    return {
        set,
        get,
    };
};
