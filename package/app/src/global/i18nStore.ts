import { set } from "@locale";
import { create } from "zustand";

type LocaleID = Parameters<typeof set>[0];

export const useLocale = create<{
    locale: undefined | LocaleID;
    setLocale: (locale: LocaleID) => void;
}>((update) => {
    return {
        locale: undefined,
        setLocale: (locale: LocaleID) => {
            update(() => {
                set(locale);
                return { locale };
            });
        },
    };
});
