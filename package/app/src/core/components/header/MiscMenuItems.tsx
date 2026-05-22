import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@rezics/ui/shadcn";
import { LANGUAGE_META, LANGUAGES, type Language } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { ThemeToggler } from "./ThemeToggler";
import { Languages as LanguageIcon } from "lucide-react";
import { setRezicsLocale } from "@/app/locale";

export function MiscMenuItems() {
  const { t } = useTranslation();

  const changeLang = (lang: Language) => setRezicsLocale(lang);

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
