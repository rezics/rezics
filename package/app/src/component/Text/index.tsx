import { useLocale } from "@/global/i18nStore";
import { get } from "@locale";

type AnyFunction = (...args: any[]) => any;

export const t = <K extends Parameters<typeof get>[0], T extends ReturnType<typeof get<K>>>(
    key: K,
    ...args: T extends AnyFunction ? Parameters<T> : []
): string => {
    const { locale } = (() => {
        try {
            return useLocale();
        } catch (error) {
            console.warn(`calling hook outside of a component is not allowed:`, error);
            return useLocale.getState();
        }
    })();

    const leaf = get(key, locale);

    return typeof leaf === "function" ? (leaf as any)(...args) : leaf;
};
