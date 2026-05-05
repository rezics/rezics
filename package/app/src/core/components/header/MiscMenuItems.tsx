import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@rezics/ui/shadcn";
import { LANGUAGE_META, LANGUAGES } from "@rezics/contract";
import { useTranslation } from "react-i18next";
import { ThemeToggler } from "./ThemeToggler";
import { Languages as LanguageIcon } from "lucide-react";

export function MiscMenuItems() {
  const { i18n, t } = useTranslation();

  const changeLang = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("lang", lang);
  };

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <LanguageIcon className="w-4 h-4" />
          <span>{t("layout.header.toggle_language")}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem onClick={() => changeLang(LANGUAGES.ZH_HANT)}>
            {LANGUAGE_META["zh-hant"].nativeName}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => changeLang(LANGUAGES.EN)}>
            {LANGUAGE_META.en.nativeName}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => changeLang(LANGUAGES.JA)}>
            {LANGUAGE_META.ja.nativeName}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => changeLang(LANGUAGES.DE)}>
            {LANGUAGE_META.de.nativeName}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => changeLang(LANGUAGES.ZH_HANS)}>
            {LANGUAGE_META["zh-hans"].nativeName}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <ThemeToggler />
    </>
  );
}
